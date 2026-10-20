"""Schemas for projects."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from protolims_api.schemas.common import Code


class ProjectCreate(BaseModel):
    """Data needed to create a project."""

    model_config = ConfigDict(extra="forbid")

    code: Code
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    source_repository: str | None = None
    licence: str | None = None
    citation: str | None = None


class ProjectRead(BaseModel):
    """A project as returned by the API."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    code: str
    name: str
    description: str | None
    source_repository: str | None
    licence: str | None
    citation: str | None
    created_at: datetime
    updated_at: datetime
    created_by: str | None
