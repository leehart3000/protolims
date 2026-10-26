"""Schemas for studies."""

import uuid
from datetime import datetime
from typing import Self

from pydantic import BaseModel, ConfigDict, Field, model_validator

from protolims_api.schemas.common import Code


class DesignFactor(BaseModel):
    """A variable under study, e.g. "compound", "dose" or "tissue type"."""

    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=100)
    description: str | None = None


class StudyCreate(BaseModel):
    """Data needed to create a study."""

    model_config = ConfigDict(extra="forbid")

    code: Code
    title: str = Field(min_length=1, max_length=300)
    description: str | None = None
    design_factors: list[DesignFactor] = Field(default_factory=list)


class StudyUpdate(BaseModel):
    """Changes to a study. Only the fields sent are changed; sending null clears the description.

    The code can't be changed, because it's part of the study's address, and a study stays in
    the project it was created in.
    """

    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, min_length=1, max_length=300)
    description: str | None = None
    design_factors: list[DesignFactor] | None = None

    @model_validator(mode="after")
    def required_fields_are_not_cleared(self) -> Self:
        """A study always has a title and a list of design factors (which may be empty)."""
        required = ("title", "design_factors")
        cleared = [f for f in required if f in self.model_fields_set and getattr(self, f) is None]
        if cleared:
            raise ValueError(f"These fields can't be cleared: {', '.join(cleared)}")
        return self


class StudyRead(BaseModel):
    """A study as returned by the API."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    code: str
    title: str
    description: str | None
    design_factors: list[DesignFactor]
    created_at: datetime
    updated_at: datetime
    created_by: str | None


class StudyWithProjectRead(StudyRead):
    """A study plus its project's code and name, for lists that span projects."""

    project_code: str
    project_name: str
