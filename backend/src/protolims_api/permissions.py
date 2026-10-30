"""Who is making a request, and what they may do.

Roles, lowest to highest: viewer (read), editor (add and change records), admin (also manage
roles). A project role covers all of that project's studies; a study role covers just that
study; someone's role on a study is the higher of the two. Site administrators (a setting,
by ORCID iD) act as admin everywhere, and can create projects.

Signing in: a browser has a session cookie (see routers/auth.py); a script sends a personal
API token instead, as "Authorization: Bearer <token>", and acts as the person who made it, with
the same permissions. A token that isn't valid answers 401, rather than being ignored, so a
script finds out at once.

Who can see what: when public reading is on (PROTOLIMS_PUBLIC_READ), everyone can see
everything. When it's off, nothing can be seen without signing in; then people see the studies
they have a role on (through the project or the study itself), and the projects those studies
are in. Anything someone can't see answers 404 Not Found, exactly as if it didn't exist, even
when they try to change it. Something they can see but not change answers 403 Forbidden.
"""

import hashlib
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Annotated, Literal

from fastapi import Cookie, Depends, Header, HTTPException, status
from sqlalchemy import ColumnElement, or_, select, true
from sqlalchemy.ext.asyncio import AsyncSession

from protolims_api.config import get_settings
from protolims_api.db import SessionDep
from protolims_api.models import (
    ApiToken,
    AppUser,
    Project,
    ProjectMember,
    Study,
    StudyMember,
    UserSession,
)

SESSION_COOKIE = "protolims_session"

# Every API token starts with this, so one is easy to recognise (in a leaked file, say).
TOKEN_PREFIX = "plt_"
# How often a token's last_used_at is brought up to date, at most.
TOKEN_USE_RECORDED_EVERY = timedelta(hours=1)

Role = Literal["viewer", "editor", "admin"]
RANKS: dict[str, int] = {"viewer": 1, "editor": 2, "admin": 3}


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


async def current_user(session: AsyncSession, token: str | None) -> AppUser | None:
    """Who the session cookie belongs to, if it's a current session."""
    if token is None:
        return None
    return await session.scalar(
        select(AppUser)
        .join(UserSession, UserSession.user_id == AppUser.id)
        .where(
            UserSession.token_hash == hash_token(token),
            UserSession.expires_at > datetime.now(UTC),
        )
    )


async def token_user(session: AsyncSession, token: str) -> AppUser:
    """Who an API token belongs to. Answers 401 if it isn't a current token."""
    now = datetime.now(UTC)
    row = (
        await session.execute(
            select(AppUser, ApiToken)
            .join(ApiToken, ApiToken.user_id == AppUser.id)
            .where(ApiToken.token_hash == hash_token(token), ApiToken.expires_at > now)
        )
    ).one_or_none()
    if row is None:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "This API token isn't valid: it may have expired or been revoked",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user, api_token = row
    if api_token.last_used_at is None or now - api_token.last_used_at > TOKEN_USE_RECORDED_EVERY:
        api_token.last_used_at = now
        await session.commit()
    return user


@dataclass(frozen=True)
class Actor:
    """Who is making a request: a signed-in user, or nobody."""

    user: AppUser | None
    site_admin: bool
    # Whether they're using an API token, rather than a browser session.
    by_token: bool = False

    @property
    def label(self) -> str | None:
        """How they're recorded in created_by and the audit trail, e.g. "orcid:0000-...".
        It's their ID with their sign-in provider, which never changes, unlike a name."""
        return None if self.user is None else f"{self.user.provider}:{self.user.subject}"


async def get_actor(
    session: SessionDep,
    session_token: Annotated[str | None, Cookie(alias=SESSION_COOKIE)] = None,
    authorization: Annotated[
        str | None, Header(description="A personal API token, as Bearer <token>")
    ] = None,
) -> Actor:
    scheme, _, token = (authorization or "").partition(" ")
    by_token = scheme.lower() == "bearer" and token != ""
    if by_token:
        user: AppUser | None = await token_user(session, token.strip())
    else:
        user = await current_user(session, session_token)
    site_admin = (
        user is not None and user.provider == "orcid" and user.subject in get_settings().site_admins
    )
    return Actor(user=user, site_admin=site_admin, by_token=by_token)


ActorDep = Annotated[Actor, Depends(get_actor)]


def higher(first: str | None, second: str | None) -> str | None:
    """The higher of two roles (None, meaning no role, is lowest)."""
    return max(first, second, key=lambda role: 0 if role is None else RANKS[role])


async def project_role(session: AsyncSession, actor: Actor, project_id: uuid.UUID) -> str | None:
    """Someone's role on a project, if any."""
    if actor.site_admin:
        return "admin"
    if actor.user is None:
        return None
    return await session.scalar(
        select(ProjectMember.role).where(
            ProjectMember.project_id == project_id, ProjectMember.user_id == actor.user.id
        )
    )


async def study_role(
    session: AsyncSession, actor: Actor, project_id: uuid.UUID, study_id: uuid.UUID
) -> str | None:
    """Someone's role on a study: the higher of their project role and their study role."""
    from_project = await project_role(session, actor, project_id)
    if from_project == "admin" or actor.user is None:
        return from_project
    from_study = await session.scalar(
        select(StudyMember.role).where(
            StudyMember.study_id == study_id, StudyMember.user_id == actor.user.id
        )
    )
    return higher(from_project, from_study)


def refuse(actor: Actor) -> HTTPException:
    """401 for someone who isn't signed in; 403 for someone who is, but may not."""
    if actor.user is None:
        return HTTPException(status.HTTP_401_UNAUTHORIZED, "Please sign in to do this")
    return HTTPException(status.HTTP_403_FORBIDDEN, "You don't have permission to do this")


async def require_sign_in_when_private(actor: ActorDep) -> None:
    """When public reading is off, stop requests from anyone who isn't signed in. Used on every
    router except signing in (and the health checks, which aren't in a router)."""
    if actor.user is None and not get_settings().public_read:
        raise refuse(actor)


def sees_everything(actor: Actor) -> bool:
    """Whether someone can see every project and study: when public reading is on, or if
    they're a site administrator."""
    return get_settings().public_read or actor.site_admin


def visible_studies(actor: Actor) -> ColumnElement[bool]:
    """A condition matching the studies someone can see, for a query on Study: those in
    projects they have a role on, and those they have a role on themselves."""
    if sees_everything(actor):
        return true()
    # Anyone not signed in was already stopped by require_sign_in_when_private.
    assert actor.user is not None
    user_id = actor.user.id
    return or_(
        Study.project_id.in_(
            select(ProjectMember.project_id).where(ProjectMember.user_id == user_id)
        ),
        Study.id.in_(select(StudyMember.study_id).where(StudyMember.user_id == user_id)),
    )


def visible_projects(actor: Actor) -> ColumnElement[bool]:
    """A condition matching the projects someone can see, for a query on Project: those they
    have a role on, and those with a study they have a role on."""
    if sees_everything(actor):
        return true()
    assert actor.user is not None  # As above.
    user_id = actor.user.id
    return or_(
        Project.id.in_(select(ProjectMember.project_id).where(ProjectMember.user_id == user_id)),
        Project.id.in_(
            select(Study.project_id)
            .join(StudyMember, StudyMember.study_id == Study.id)
            .where(StudyMember.user_id == user_id)
        ),
    )


async def can_see_study(session: AsyncSession, actor: Actor, study_id: uuid.UUID) -> bool:
    """Whether someone can see a study, and so every record in it."""
    if sees_everything(actor):
        return True
    found = await session.scalar(
        select(Study.id).where(Study.id == study_id, visible_studies(actor))
    )
    return found is not None


def require(actor: Actor, role: str | None, needed: Role) -> None:
    """Stop the request unless role is at least the role needed."""
    if role is None or RANKS[role] < RANKS[needed]:
        raise refuse(actor)


def require_site_admin(actor: Actor) -> None:
    """Stop the request unless it's from a site administrator."""
    if not actor.site_admin:
        raise refuse(actor)


async def require_project_role(
    session: AsyncSession, actor: Actor, project_id: uuid.UUID, needed: Role
) -> None:
    """Stop the request unless the actor has at least this role on the project."""
    require(actor, await project_role(session, actor, project_id), needed)


async def require_study_role(
    session: AsyncSession, actor: Actor, study: Study, needed: Role
) -> None:
    """Stop the request unless the actor has at least this role on the study."""
    require(actor, await study_role(session, actor, study.project_id, study.id), needed)


async def require_editor_of(session: AsyncSession, actor: Actor, study_id: uuid.UUID) -> None:
    """For a record fetched by its own ID: stop the request unless the actor can edit the
    study it belongs to."""
    study = await session.get(Study, study_id)
    assert study is not None  # Every record belongs to a study, and studies aren't deleted.
    await require_study_role(session, actor, study, "editor")
