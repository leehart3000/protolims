"""Request and response bodies for subjects."""

import uuid
from datetime import datetime
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field

# Names of subjects (and later samples) often come from outside sources and may contain
# spaces (e.g. the cell line "Hs 578T"). They can't contain a slash, because they appear
# in web addresses, or start or end with a space.
Name = Annotated[str, Field(min_length=1, max_length=200, pattern=r"^[^/\s](?:[^/]*[^/\s])?$")]

SubjectType = Literal["patient", "cell_line", "organism", "other"]


class SubjectCreate(BaseModel):
    """Data needed to create a subject."""

    model_config = ConfigDict(extra="forbid")

    name: Name
    external_id: str | None = Field(default=None, max_length=200)
    subject_type: SubjectType
    species: str | None = Field(default=None, max_length=200)
    attributes: dict[str, Any] = Field(default_factory=dict)


class SubjectRead(BaseModel):
    """A subject as returned by the API."""

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
