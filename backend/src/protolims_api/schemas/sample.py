"""Request and response bodies for samples."""

import uuid
from datetime import datetime
from typing import Any, Literal, Self

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, model_validator

from protolims_api.schemas.common import Name

SampleStatus = Literal["registered", "received", "in_storage", "in_use", "consumed", "disposed"]


class SampleCreate(BaseModel):
    """Data needed to create a sample."""

    model_config = ConfigDict(extra="forbid")

    name: Name
    external_id: str | None = Field(default=None, max_length=200)
    subject_id: uuid.UUID | None = None
    parent_sample_id: uuid.UUID | None = None
    material_type: str = Field(min_length=1, max_length=100)
    status: SampleStatus = "registered"
    # Must include a time zone, e.g. "2026-10-01T09:00:00Z", so times are never ambiguous.
    collected_at: AwareDatetime | None = None
    characteristics: dict[str, Any] = Field(default_factory=dict)
    factor_values: dict[str, Any] = Field(default_factory=dict)


class SampleUpdate(BaseModel):
    """Changes to a sample. Only the fields sent are changed; sending null clears a field.

    The study can't be changed: a sample stays in the study it was created in.
    """

    model_config = ConfigDict(extra="forbid")

    name: Name | None = None
    external_id: str | None = Field(default=None, max_length=200)
    subject_id: uuid.UUID | None = None
    parent_sample_id: uuid.UUID | None = None
    material_type: str | None = Field(default=None, min_length=1, max_length=100)
    status: SampleStatus | None = None
    collected_at: AwareDatetime | None = None
    characteristics: dict[str, Any] | None = None
    factor_values: dict[str, Any] | None = None

    @model_validator(mode="after")
    def required_fields_are_not_cleared(self) -> Self:
        """A sample always has a name, material, status, characteristics and factor values."""
        required = ("name", "material_type", "status", "characteristics", "factor_values")
        cleared = [f for f in required if f in self.model_fields_set and getattr(self, f) is None]
        if cleared:
            raise ValueError(f"These fields can't be cleared: {', '.join(cleared)}")
        return self


class SampleFields(BaseModel):
    """A sample's own fields, read from the database."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    study_id: uuid.UUID
    name: str
    external_id: str | None
    subject_id: uuid.UUID | None
    parent_sample_id: uuid.UUID | None
    material_type: str
    status: str
    collected_at: datetime | None
    characteristics: dict[str, Any]
    factor_values: dict[str, Any]
    created_at: datetime
    updated_at: datetime
    created_by: str | None


class SampleRead(SampleFields):
    """A sample as returned by the API, with where it belongs and what it's linked to."""

    project_code: str
    study_code: str
    subject_name: str | None
    parent_sample_name: str | None
