"""Schemas for studies."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

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
