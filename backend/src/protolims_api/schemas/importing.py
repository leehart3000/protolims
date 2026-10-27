"""Request and response bodies for importing a study's records."""

import uuid
from typing import Annotated, Any, Literal, Self

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, model_validator

from protolims_api.schemas.common import Name
from protolims_api.schemas.data_file import DataFileLevel, Sha256, Uri
from protolims_api.schemas.sample import SampleStatus
from protolims_api.schemas.subject import SubjectType

# The most records (and links) one import request may hold; bigger studies are sent in batches.
MAX_RECORDS = 5000

ExternalId = Annotated[str, Field(min_length=1, max_length=200)]
Label = Annotated[str, Field(min_length=1, max_length=100)]


class SubjectImport(BaseModel):
    """A subject to import. It's matched by external ID, or by name if it has none."""

    model_config = ConfigDict(extra="forbid")

    name: Name
    external_id: ExternalId | None = None
    subject_type: SubjectType
    species: str | None = Field(default=None, max_length=200)
    attributes: dict[str, Any] = Field(default_factory=dict)


class SampleImport(BaseModel):
    """A sample to import. It's matched by external ID, or by name if it has none.

    Its subject and parent are given by name: of a record in the same request, or of one
    already in the study.
    """

    model_config = ConfigDict(extra="forbid")

    name: Name
    external_id: ExternalId | None = None
    subject: Name | None = None
    parent: Name | None = None
    material_type: str = Field(min_length=1, max_length=100)
    status: SampleStatus = "registered"
    # Must include a time zone, e.g. "2026-10-01T09:00:00Z", so times are never ambiguous.
    collected_at: AwareDatetime | None = None
    characteristics: dict[str, Any] = Field(default_factory=dict)
    factor_values: dict[str, Any] = Field(default_factory=dict)


class AssaySampleImport(BaseModel):
    """A sample an assay measured, by name, with its label in the assay (e.g. a TMT channel)."""

    model_config = ConfigDict(extra="forbid")

    sample: Name
    label: Label | None = None


class AssayImport(BaseModel):
    """An assay to import. It's matched by external ID, or by name if it has none.

    Its samples are given by name: of a sample in the same request, or of one already in
    the study.
    """

    model_config = ConfigDict(extra="forbid")

    name: Name
    external_id: ExternalId | None = None
    measurement_type: str = Field(min_length=1, max_length=100)
    technology_type: str = Field(min_length=1, max_length=100)
    platform: str | None = Field(default=None, max_length=200)
    # Must include a time zone, e.g. "2026-10-01T09:00:00Z", so times are never ambiguous.
    performed_at: AwareDatetime | None = None
    parameters: dict[str, Any] = Field(default_factory=dict)
    samples: list[AssaySampleImport] = Field(default_factory=list)


class DataFileSampleImport(BaseModel):
    """A sample whose data is in a file, by name, with where it is (e.g. a matrix column)."""

    model_config = ConfigDict(extra="forbid")

    sample: Name
    label: Label | None = None


class DataFileImport(BaseModel):
    """A data file to import. It's matched by external ID, or by location (uri) if it has none,
    as file names often repeat.

    Its assay and samples are given by name, and the files it was made from by location: of
    records in the same request, or already in the study.
    """

    model_config = ConfigDict(extra="forbid")

    name: Name
    external_id: ExternalId | None = None
    uri: Uri
    level: DataFileLevel
    format: str = Field(min_length=1, max_length=50)
    assay: Name | None = None
    size_bytes: int | None = Field(default=None, ge=0)
    sha256: Sha256 | None = None
    summary: dict[str, Any] = Field(default_factory=dict)
    samples: list[DataFileSampleImport] = Field(default_factory=list)
    inputs: list[Uri] = Field(default_factory=list)


class ImportRequest(BaseModel):
    """Records to import into a study."""

    model_config = ConfigDict(extra="forbid")

    # Who or what is importing, e.g. "GDC TCGA-BRCA, 27 October 2026". It's recorded in the
    # audit trail and as each new record's creator.
    source: str = Field(min_length=1, max_length=200)
    # true: check everything and report what would happen, but save nothing. Required, so
    # nothing is ever saved by accident.
    dry_run: bool
    subjects: list[SubjectImport] = Field(default_factory=list)
    samples: list[SampleImport] = Field(default_factory=list)
    assays: list[AssayImport] = Field(default_factory=list)
    data_files: list[DataFileImport] = Field(default_factory=list)

    @model_validator(mode="after")
    def not_too_many(self) -> Self:
        """Keep each request to a manageable size."""
        links = sum(len(assay.samples) for assay in self.assays) + sum(
            len(file.samples) + len(file.inputs) for file in self.data_files
        )
        total = (
            len(self.subjects) + len(self.samples) + len(self.assays) + len(self.data_files) + links
        )
        if total > MAX_RECORDS:
            raise ValueError(
                f"An import can hold at most {MAX_RECORDS} records and links, but this one "
                f"has {total}. Please send it in batches."
            )
        return self


class KindSummary(BaseModel):
    """How many records of one kind were (or would be) created, and how many already existed."""

    created: int = 0
    unchanged: int = 0
    different: int = 0


class Difference(BaseModel):
    """An existing record or link that differs from the import. It was left unchanged."""

    kind: Literal["subject", "sample", "assay", "assay sample", "data file", "data file sample"]
    # The record's name (a data file's location); for a link, "<owner> / <sample>".
    name: str
    # The record's ID; for a link, its owner's (the assay's or data file's).
    id: uuid.UUID
    # For each field the import sent that differs: what's recorded, and what the import says.
    fields: dict[str, dict[str, Any]]


class ImportResult(BaseModel):
    """What an import did, or with a dry run, what it would do."""

    dry_run: bool
    saved: bool
    subjects: KindSummary
    samples: KindSummary
    assays: KindSummary
    assay_samples: KindSummary
    data_files: KindSummary
    data_file_samples: KindSummary
    data_file_inputs: KindSummary
    differences: list[Difference]
