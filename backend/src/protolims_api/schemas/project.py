"""Schemas for projects."""

import uuid
from datetime import datetime
from typing import Self

from pydantic import BaseModel, ConfigDict, Field, model_validator

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


class ProjectUpdate(BaseModel):
    """Changes to a project. Only the fields sent are changed; sending null clears a field.

    The code can't be changed, because it's part of the project's address and its studies'.
    """

    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    source_repository: str | None = None
    licence: str | None = None
    citation: str | None = None

    @model_validator(mode="after")
    def name_is_not_cleared(self) -> Self:
        """A project always has a name."""
        if "name" in self.model_fields_set and self.name is None:
            raise ValueError("The name can't be cleared")
        return self


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
