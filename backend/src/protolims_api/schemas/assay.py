"""Request and response bodies for assays."""

import uuid
from datetime import datetime
from typing import Any, Self

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, model_validator

from protolims_api.schemas.common import Name


class AssayCreate(BaseModel):
    """Data needed to create an assay."""

    model_config = ConfigDict(extra="forbid")

    name: Name
    external_id: str | None = Field(default=None, min_length=1, max_length=200)
    # What was measured, e.g. "transcription profiling" or "protein expression profiling".
    measurement_type: str = Field(min_length=1, max_length=100)
    # How it was measured, e.g. "nucleotide sequencing" or "mass spectrometry".
    technology_type: str = Field(min_length=1, max_length=100)
    # The instrument, e.g. "Illumina HiSeq 2000".
    platform: str | None = Field(default=None, max_length=200)
    # Must include a time zone, e.g. "2026-10-01T09:00:00Z", so times are never ambiguous.
    performed_at: AwareDatetime | None = None
    parameters: dict[str, Any] = Field(default_factory=dict)


class AssayUpdate(BaseModel):
    """Changes to an assay. Only the fields sent are changed; sending null clears a field.

    The study can't be changed: an assay stays in the study it was created in.
    """

    model_config = ConfigDict(extra="forbid")

    name: Name | None = None
    external_id: str | None = Field(default=None, min_length=1, max_length=200)
    measurement_type: str | None = Field(default=None, min_length=1, max_length=100)
    technology_type: str | None = Field(default=None, min_length=1, max_length=100)
    platform: str | None = Field(default=None, max_length=200)
    performed_at: AwareDatetime | None = None
    parameters: dict[str, Any] | None = None

    @model_validator(mode="after")
    def required_fields_are_not_cleared(self) -> Self:
        """An assay always has a name, measurement type, technology type and parameters."""
        required = ("name", "measurement_type", "technology_type", "parameters")
        cleared = [f for f in required if f in self.model_fields_set and getattr(self, f) is None]
        if cleared:
            raise ValueError(f"These fields can't be cleared: {', '.join(cleared)}")
        return self


class AssayFields(BaseModel):
    """An assay's own fields, read from the database."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    study_id: uuid.UUID
    name: str
    external_id: str | None
    measurement_type: str
    technology_type: str
    platform: str | None
    performed_at: datetime | None
    parameters: dict[str, Any]
    created_at: datetime
    updated_at: datetime
    created_by: str | None


class AssayRead(AssayFields):
    """An assay as returned by the API, with where it belongs and how many samples it measured."""

    project_code: str
    study_code: str
    sample_count: int


class AssaySampleLink(BaseModel):
    """Links a sample to an assay, or changes its label there."""

    model_config = ConfigDict(extra="forbid")

    # Where this sample is within the assay, e.g. a TMT channel such as "127N".
    label: str | None = Field(default=None, min_length=1, max_length=100)


class AssaySampleRead(BaseModel):
    """A sample measured in an assay, with its label there."""

    sample_id: uuid.UUID
    sample_name: str
    external_id: str | None
    material_type: str
    status: str
    label: str | None


class SampleAssayRead(BaseModel):
    """An assay a sample was measured in, with the sample's label there."""

    assay_id: uuid.UUID
    assay_name: str
    measurement_type: str
    technology_type: str
    platform: str | None
    label: str | None
