"""Who is making a request, and what they may do.

Roles, lowest to highest: viewer (read), editor (add and change records), admin (also manage
roles). A project role covers all of that project's studies; a study role covers just that
study; someone's role on a study is the higher of the two. Site administrators (a setting,
by ORCID iD) act as admin everywhere, and can create projects.
"""

import hashlib
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Annotated, Literal

from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from protolims_api.config import get_settings
from protolims_api.db import SessionDep
from protolims_api.models import AppUser, ProjectMember, Study, StudyMember, UserSession

SESSION_COOKIE = "protolims_session"

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


@dataclass(frozen=True)
class Actor:
    """Who is making a request: a signed-in user, or nobody."""

    user: AppUser | None
    site_admin: bool

    @property
    def label(self) -> str | None:
        """How they're recorded in created_by and the audit trail, e.g. "orcid:0000-...".
        It's their ID with their sign-in provider, which never changes, unlike a name."""
        return None if self.user is None else f"{self.user.provider}:{self.user.subject}"


async def get_actor(
    session: SessionDep,
    session_token: Annotated[str | None, Cookie(alias=SESSION_COOKIE)] = None,
) -> Actor:
    user = await current_user(session, session_token)
    site_admin = (
        user is not None and user.provider == "orcid" and user.subject in get_settings().site_admins
    )
    return Actor(user=user, site_admin=site_admin)


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
