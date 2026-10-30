"""Personal API tokens: made, listed and revoked by their owner, from the website.

A token lets a script (such as an import) act as the person who made it, with the same
permissions, by sending "Authorization: Bearer <token>". It's shown once, when it's made; only
a hash of it is kept. Tokens can't be used to make or revoke tokens, so a leaked token can't
be used to keep itself going or to make more.
"""

import secrets
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from protolims_api.audit import record_event
from protolims_api.db import SessionDep
from protolims_api.models import ApiToken
from protolims_api.permissions import TOKEN_PREFIX, Actor, ActorDep, hash_token, refuse
from protolims_api.schemas.user import ApiTokenCreate, ApiTokenCreated, ApiTokenRead

router = APIRouter(prefix="/auth/me/tokens", tags=["auth"])

# How many characters of a token are kept to tell it apart: the prefix and four more.
HINT_LENGTH = len(TOKEN_PREFIX) + 4


def require_browser(actor: Actor) -> uuid.UUID:
    """The signed-in person's ID, if they're signed in on the website (not using a token)."""
    if actor.user is None:
        raise refuse(actor)
    if actor.by_token:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "API tokens can only be managed on the website, when signed in",
        )
    return actor.user.id


@router.get("")
async def list_tokens(session: SessionDep, actor: ActorDep) -> list[ApiTokenRead]:
    """The signed-in person's API tokens, newest first, including any that have expired."""
    user_id = require_browser(actor)
    tokens = await session.scalars(
        select(ApiToken)
        .where(ApiToken.user_id == user_id)
        .order_by(ApiToken.created_at.desc(), ApiToken.id.desc())
    )
    return [ApiTokenRead.model_validate(token) for token in tokens]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_token(
    payload: ApiTokenCreate, session: SessionDep, actor: ActorDep
) -> ApiTokenCreated:
    """Make a new API token. The reply includes the token itself: this is the only time it's
    shown, so keep it somewhere safe straight away."""
    user_id = require_browser(actor)
    token = TOKEN_PREFIX + secrets.token_urlsafe(32)
    api_token = ApiToken(
        token_hash=hash_token(token),
        user_id=user_id,
        name=payload.name,
        hint=token[:HINT_LENGTH],
        expires_at=datetime.now(UTC) + timedelta(days=payload.days),
    )
    session.add(api_token)
    await session.flush()
    await record_event(
        session,
        action="create",
        entity_type="api_token",
        entity_id=api_token.id,
        actor=actor.label,
        changes={"after": {"name": api_token.name, "expires_at": api_token.expires_at.isoformat()}},
    )
    await session.commit()
    await session.refresh(api_token)
    return ApiTokenCreated(**ApiTokenRead.model_validate(api_token).model_dump(), token=token)


@router.delete("/{token_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_token(token_id: uuid.UUID, session: SessionDep, actor: ActorDep) -> None:
    """Revoke one of the signed-in person's API tokens, so it can't be used again."""
    user_id = require_browser(actor)
    api_token = await session.scalar(
        select(ApiToken).where(ApiToken.id == token_id, ApiToken.user_id == user_id)
    )
    if api_token is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "API token not found")
    await record_event(
        session,
        action="revoke",
        entity_type="api_token",
        entity_id=api_token.id,
        actor=actor.label,
        changes={"before": {"name": api_token.name}},
    )
    await session.delete(api_token)
    await session.commit()
