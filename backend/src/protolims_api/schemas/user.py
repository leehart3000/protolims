"""Schemas for people who sign in, and their roles."""

import uuid

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


class MemberRole(BaseModel):
    """The role to give someone."""

    model_config = ConfigDict(extra="forbid")

    role: Role


class MemberRead(BaseModel):
    """Someone's role on a project or study."""

    user: UserRead
    role: Role
