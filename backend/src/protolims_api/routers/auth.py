"""Signing in with ORCID (OpenID Connect), and who is signed in.

The API does the whole sign-in itself, so the browser never holds any tokens:

1. /auth/orcid/login sends the browser to ORCID, with a random "state" (also kept in a
   short-lived cookie) and "nonce".
2. ORCID sends the browser back to /auth/orcid/callback with a one-time code. The API checks
   the state, swaps the code for an ID token (using the client secret, which never leaves the
   server), and checks the token: its signature against ORCID's published keys, who issued
   it, who it's for, that it hasn't expired, and the nonce.
3. The API remembers the person (by their ORCID iD) and gives the browser a session cookie:
   HttpOnly, so page scripts can't read it, and only a hash of it is stored.
"""

import logging
import secrets
from datetime import UTC, datetime, timedelta
from typing import Annotated, Any
from urllib.parse import urlencode

import httpx
import jwt
from fastapi import APIRouter, Cookie, HTTPException, Query, Response, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from protolims_api.activity import activity_page
from protolims_api.config import Settings, get_settings
from protolims_api.db import SessionDep
from protolims_api.models import AppUser, SignInAttempt, UserSession
from protolims_api.permissions import SESSION_COOKIE, ActorDep, hash_token, refuse
from protolims_api.roles import roles_of_users
from protolims_api.schemas.common import Page
from protolims_api.schemas.user import ActivityRead, RoleRead, SignedInUser

router = APIRouter(prefix="/auth", tags=["auth"])

STATE_COOKIE = "protolims_sign_in"
AUTH_PATH = "/api/v1/auth"
CALLBACK_PATH = f"{AUTH_PATH}/orcid/callback"
SIGN_IN_MINUTES = 10
INVALID_SIGN_IN = "This sign-in has expired or isn't valid. Please sign in again."
UNCHECKED_REPLY = "ORCID's reply couldn't be checked, so you haven't been signed in."
# How far this server's clock and ORCID's may disagree when checking when an ID token was
# issued and when it expires. Without it, a clock a few seconds behind ORCID's makes a token
# look "not yet valid", and the sign-in fails.
CLOCK_LEEWAY = timedelta(minutes=2)

# Why a sign-in was refused goes to the server's log (never to the browser), for diagnosis.
logger = logging.getLogger(__name__)

# Tests replace this with a fake ORCID; normally it's None, meaning the real network.
transport: httpx.AsyncBaseTransport | None = None


class Me(BaseModel):
    """Who is signed in on this browser (null if nobody), and what this server allows."""

    user: SignedInUser | None
    # Whether they're a site administrator.
    site_admin: bool
    # Whether people who aren't signed in can read everything here.
    public_read: bool
    # Their roles, so the website can show what they can do: project roles, then study roles.
    # A study role adds to any role on its project; site administrators can do everything.
    roles: list[RoleRead]


def safe_return_to(value: str | None) -> str:
    """Only go back to a page on this site: a path starting with a single slash."""
    if value and value.startswith("/") and not value.startswith(("//", "/\\")):
        return value
    return "/"


def orcid_settings() -> Settings:
    """The settings, or 503 if sign-in with ORCID isn't set up on this server."""
    settings = get_settings()
    if settings.orcid_client_id is None or settings.orcid_client_secret is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Sign-in with ORCID isn't set up on this server",
        )
    return settings


def redirect_uri(settings: Settings) -> str:
    return settings.public_url.rstrip("/") + CALLBACK_PATH


def secure_cookies(settings: Settings) -> bool:
    return settings.public_url.startswith("https://")


async def exchange_code(client: httpx.AsyncClient, settings: Settings, code: str) -> str:
    """Swap the one-time code ORCID sent back for an ID token."""
    assert settings.orcid_client_secret is not None
    response = await client.post(
        f"{settings.orcid_base_url}/oauth/token",
        data={
            "client_id": settings.orcid_client_id,
            "client_secret": settings.orcid_client_secret.get_secret_value(),
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect_uri(settings),
        },
        headers={"Accept": "application/json"},
    )
    id_token = response.json().get("id_token") if response.status_code == 200 else None
    if not isinstance(id_token, str):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="ORCID didn't complete the sign-in. Please try again.",
        )
    return id_token


async def signing_key(client: httpx.AsyncClient, settings: Settings, id_token: str) -> Any:
    """The public key, from ORCID's published keys, that the ID token says it was signed with."""
    response = await client.get(f"{settings.orcid_base_url}/oauth/jwks")
    try:
        keys = jwt.PyJWKSet.from_dict(response.json()).keys
        key_id = jwt.get_unverified_header(id_token).get("kid")
    except (ValueError, jwt.PyJWTError) as exc:
        logger.warning("ORCID's keys or the ID token's header couldn't be read: %s", exc)
        raise HTTPException(status.HTTP_400_BAD_REQUEST, UNCHECKED_REPLY) from exc
    for key in keys:
        if key_id is None or key.key_id == key_id:
            return key.key
    logger.warning("ORCID's published keys don't include the ID token's key %r", key_id)
    raise HTTPException(status.HTTP_400_BAD_REQUEST, UNCHECKED_REPLY)


def checked_claims(settings: Settings, id_token: str, key: Any, nonce: str) -> dict[str, Any]:
    """The ID token's contents, once its signature, issuer, audience, age and nonce check out."""
    try:
        claims: dict[str, Any] = jwt.decode(
            id_token,
            key,
            algorithms=["RS256"],
            audience=settings.orcid_client_id,
            issuer=settings.orcid_base_url,
            options={"require": ["exp", "iat", "sub", "nonce"]},
            leeway=CLOCK_LEEWAY,
        )
    except jwt.PyJWTError as exc:
        logger.warning("ORCID's ID token didn't check out: %s", exc)
        raise HTTPException(status.HTTP_400_BAD_REQUEST, UNCHECKED_REPLY) from exc
    if not secrets.compare_digest(str(claims["nonce"]), nonce):
        logger.warning("ORCID's ID token has the wrong nonce")
        raise HTTPException(status.HTTP_400_BAD_REQUEST, UNCHECKED_REPLY)
    return claims


def display_name(claims: dict[str, Any]) -> str | None:
    """The person's name, if ORCID shared it (they choose what's public)."""
    parts = [claims.get("given_name"), claims.get("family_name")]
    return " ".join(part for part in parts if isinstance(part, str) and part) or None


async def remember_user(session: AsyncSession, subject: str, name: str | None) -> AppUser:
    """Find the person by their ORCID iD, or add them; update their name and sign-in time."""
    user = await session.scalar(
        select(AppUser).where(AppUser.provider == "orcid", AppUser.subject == subject)
    )
    if user is None:
        user = AppUser(provider="orcid", subject=subject)
        session.add(user)
    user.name = name
    user.last_signed_in_at = datetime.now(UTC)
    await session.flush()
    return user


@router.get("/orcid/login", response_class=RedirectResponse, status_code=status.HTTP_302_FOUND)
async def sign_in_with_orcid(
    session: SessionDep,
    return_to: Annotated[
        str | None, Query(description="The page on this site to go back to afterwards")
    ] = None,
) -> RedirectResponse:
    """Start signing in: go to ORCID, which will send the browser back to the callback."""
    settings = orcid_settings()
    state = secrets.token_urlsafe(32)
    nonce = secrets.token_urlsafe(32)
    cutoff = datetime.now(UTC) - timedelta(minutes=SIGN_IN_MINUTES)
    await session.execute(delete(SignInAttempt).where(SignInAttempt.created_at < cutoff))
    session.add(
        SignInAttempt(
            state_hash=hash_token(state), nonce=nonce, return_to=safe_return_to(return_to)
        )
    )
    await session.commit()

    query = urlencode(
        {
            "client_id": settings.orcid_client_id,
            "response_type": "code",
            "scope": "openid",
            "redirect_uri": redirect_uri(settings),
            "state": state,
            "nonce": nonce,
        }
    )
    response = RedirectResponse(
        f"{settings.orcid_base_url}/oauth/authorize?{query}", status_code=status.HTTP_302_FOUND
    )
    response.set_cookie(
        STATE_COOKIE,
        state,
        max_age=SIGN_IN_MINUTES * 60,
        path=AUTH_PATH,
        secure=secure_cookies(settings),
        httponly=True,
        samesite="lax",
    )
    return response


@router.get("/orcid/callback", response_class=RedirectResponse, status_code=status.HTTP_302_FOUND)
async def orcid_callback(
    session: SessionDep,
    state: str | None = None,
    code: str | None = None,
    error: str | None = None,
    sign_in_state: Annotated[str | None, Cookie(alias=STATE_COOKIE)] = None,
) -> RedirectResponse:
    """Finish signing in, when ORCID sends the browser back. Then go back to where it started.

    If the person cancelled at ORCID, nobody is signed in and the browser just goes back.
    """
    settings = orcid_settings()
    if state is None or sign_in_state is None or not secrets.compare_digest(state, sign_in_state):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, INVALID_SIGN_IN)
    attempt = await session.get(SignInAttempt, hash_token(state))
    cutoff = datetime.now(UTC) - timedelta(minutes=SIGN_IN_MINUTES)
    if attempt is None or attempt.created_at < cutoff:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, INVALID_SIGN_IN)
    # Each sign-in can be finished only once.
    nonce, return_to = attempt.nonce, attempt.return_to
    await session.delete(attempt)
    await session.commit()

    response = RedirectResponse(return_to, status_code=status.HTTP_302_FOUND)
    response.delete_cookie(STATE_COOKIE, path=AUTH_PATH)
    if error is not None or code is None:
        return response

    async with httpx.AsyncClient(timeout=30, transport=transport) as client:
        id_token = await exchange_code(client, settings, code)
        key = await signing_key(client, settings, id_token)
    claims = checked_claims(settings, id_token, key, nonce)
    user = await remember_user(session, str(claims["sub"]), display_name(claims))

    token = secrets.token_urlsafe(32)
    session.add(
        UserSession(
            token_hash=hash_token(token),
            user_id=user.id,
            expires_at=datetime.now(UTC) + timedelta(days=settings.session_days),
        )
    )
    await session.commit()
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=settings.session_days * 24 * 60 * 60,
        path="/",
        secure=secure_cookies(settings),
        httponly=True,
        samesite="lax",
    )
    return response


@router.get("/me")
async def who_am_i(session: SessionDep, actor: ActorDep) -> Me:
    """Who is signed in on this browser, if anyone, what they can do, and what this server
    allows."""
    user = actor.user
    return Me(
        user=None if user is None else SignedInUser.model_validate(user),
        site_admin=actor.site_admin,
        public_read=get_settings().public_read,
        roles=[] if user is None else (await roles_of_users(session, [user.id]))[user.id],
    )


@router.get("/me/activity")
async def my_activity(
    session: SessionDep,
    actor: ActorDep,
    limit: Annotated[int, Query(ge=1, le=500)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> Page[ActivityRead]:
    """The changes the signed-in person has made, newest first, a page at a time, with the
    total number. Each names what it was made to, unless that has since been removed or is
    somewhere they can no longer see."""
    if actor.user is None:
        raise refuse(actor)
    return await activity_page(session, actor, limit, offset)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def sign_out(
    session: SessionDep,
    session_token: Annotated[str | None, Cookie(alias=SESSION_COOKIE)] = None,
) -> Response:
    """Sign this browser out, ending its session."""
    if session_token is not None:
        await session.execute(
            delete(UserSession).where(UserSession.token_hash == hash_token(session_token))
        )
        await session.commit()
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    response.delete_cookie(SESSION_COOKIE, path="/")
    return response
