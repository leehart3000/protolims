"""Request and response bodies for subjects."""

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

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
