"""Request and response bodies for subjects."""

import uuid
from datetime import datetime
from typing import Any, Literal, Self

from pydantic import BaseModel, ConfigDict, Field, model_validator

from protolims_api.schemas.common import Name

SubjectType = Literal["patient", "cell_line", "organism", "other"]


class SubjectCreate(BaseModel):
    """Data needed to create a subject."""

    model_config = ConfigDict(extra="forbid")

    name: Name
    external_id: str | None = Field(default=None, max_length=200)
    subject_type: SubjectType
    species: str | None = Field(default=None, max_length=200)
    attributes: dict[str, Any] = Field(default_factory=dict)


class SubjectUpdate(BaseModel):
    """Changes to a subject. Only the fields sent are changed; sending null clears a field.

    The study can't be changed: a subject stays in the study it was created in.
    """

    model_config = ConfigDict(extra="forbid")

    name: Name | None = None
    external_id: str | None = Field(default=None, max_length=200)
    subject_type: SubjectType | None = None
    species: str | None = Field(default=None, max_length=200)
    attributes: dict[str, Any] | None = None

    @model_validator(mode="after")
    def required_fields_are_not_cleared(self) -> Self:
        """A subject always has a name, a type and attributes (which may be empty)."""
        required = ("name", "subject_type", "attributes")
        cleared = [f for f in required if f in self.model_fields_set and getattr(self, f) is None]
        if cleared:
            raise ValueError(f"These fields can't be cleared: {', '.join(cleared)}")
        return self


class SubjectFields(BaseModel):
    """A subject's own fields, read from the database."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    study_id: uuid.UUID
    name: str
    external_id: str | None
    subject_type: str
    species: str | None
    attributes: dict[str, Any]
    created_at: datetime
    updated_at: datetime
    created_by: str | None


class SubjectRead(SubjectFields):
    """A subject as returned by the API, with the codes of its study and project."""

    project_code: str
    study_code: str
