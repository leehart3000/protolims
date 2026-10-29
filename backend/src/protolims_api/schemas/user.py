"""Schemas for people who sign in, and their roles."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from protolims_api.permissions import Role


class UserRead(BaseModel):
    """Someone who has signed in, or been added by their ORCID iD ahead of signing in."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    provider: str
    subject: str
    # As their sign-in provider gave it; null until they first sign in, or if it's private.
    name: str | None


class RoleRead(BaseModel):
    """One of someone's roles: on a whole project (study is null), or on one study in it."""

    project: str
    study: str | None
    role: Role


class UserSummary(UserRead):
    """Someone, for the site administrators' list of everyone: when they joined and last
    signed in, and their roles."""

    created_at: datetime
    # Null for someone added by their ORCID iD who hasn't signed in yet.
    last_signed_in_at: datetime | None
    # Whether they're a site administrator (set by PROTOLIMS_SITE_ADMINS, not here).
    site_admin: bool
    roles: list[RoleRead]


class MemberRole(BaseModel):
    """The role to give someone."""

    model_config = ConfigDict(extra="forbid")

    role: Role


class MemberRead(BaseModel):
    """Someone's role on a project or study."""

    user: UserRead
    role: Role
