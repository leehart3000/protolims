"""Request and response bodies for data files."""

import uuid
from datetime import datetime
from typing import Annotated, Any, Literal, Self
from urllib.parse import parse_qsl, urlsplit

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, model_validator

from protolims_api.schemas.common import Name

DataFileLevel = Literal["raw", "processed", "analysis"]

# Where a file can be: in cloud storage (S3 and S3-compatible such as Cloudflare R2, Google
# Cloud Storage, Azure Blob Storage) or at its source on the web, over an encrypted connection.
ALLOWED_SCHEMES = frozenset({"s3", "gs", "az", "https"})
STORAGE_SCHEMES = frozenset({"s3", "gs", "az"})

# Query parameters that mark a temporary "signed" link (AWS, Google, Azure and others). These
# act as keys, so they must never be stored or shown.
SIGNATURE_PARAMETERS = frozenset({"x-amz-signature", "x-goog-signature", "sig", "signature"})


def _safe_uri(uri: str) -> str:
    """Accept only addresses that are safe to store and show as links.

    The API only stores these; it never fetches them.
    """
    parts = urlsplit(uri)
    if parts.scheme not in ALLOWED_SCHEMES:
        raise ValueError("The URI must start with s3://, gs://, az:// or https://")
    if not parts.netloc:
        raise ValueError("The URI must include a bucket, container or host")
    if "@" in parts.netloc:
        raise ValueError("The URI can't contain a user name or password")
    if parts.scheme in STORAGE_SCHEMES and parts.path in ("", "/"):
        raise ValueError("The URI must name a file, not just a bucket or container")
    parameters = {name.lower() for name, _ in parse_qsl(parts.query, keep_blank_values=True)}
    if parameters & SIGNATURE_PARAMETERS:
        raise ValueError("The URI can't be a signed link, as those contain temporary keys")
    return uri


# Where the file is, e.g. "s3://bucket/path/file.bam" or a source's download link.
Uri = Annotated[
    str, Field(min_length=1, max_length=2000, pattern=r"^\S+$"), AfterValidator(_safe_uri)
]

Sha256 = Annotated[str, Field(pattern=r"^[0-9a-f]{64}$")]


class DataFileCreate(BaseModel):
    """Data needed to record a data file."""

    model_config = ConfigDict(extra="forbid")

    name: Name
    external_id: str | None = Field(default=None, min_length=1, max_length=200)
    assay_id: uuid.UUID | None = None
    level: DataFileLevel
    # The file format, e.g. "FASTQ", "BAM", "TSV" or "mzML".
    format: str = Field(min_length=1, max_length=50)
    uri: Uri
    size_bytes: int | None = Field(default=None, ge=0)
    sha256: Sha256 | None = None
    summary: dict[str, Any] = Field(default_factory=dict)


class DataFileUpdate(BaseModel):
    """Changes to a data file. Only the fields sent are changed; sending null clears a field.

    The study can't be changed: a file record stays in the study it was created in.
    """

    model_config = ConfigDict(extra="forbid")

    name: Name | None = None
    external_id: str | None = Field(default=None, min_length=1, max_length=200)
    assay_id: uuid.UUID | None = None
    level: DataFileLevel | None = None
    format: str | None = Field(default=None, min_length=1, max_length=50)
    uri: Uri | None = None
    size_bytes: int | None = Field(default=None, ge=0)
    sha256: Sha256 | None = None
    summary: dict[str, Any] | None = None

    @model_validator(mode="after")
    def required_fields_are_not_cleared(self) -> Self:
        """A data file always has a name, level, format, URI and summary."""
        required = ("name", "level", "format", "uri", "summary")
        cleared = [f for f in required if f in self.model_fields_set and getattr(self, f) is None]
        if cleared:
            raise ValueError(f"These fields can't be cleared: {', '.join(cleared)}")
        return self


class DataFileFields(BaseModel):
    """A data file's own fields, read from the database."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    study_id: uuid.UUID
    assay_id: uuid.UUID | None
    name: str
    external_id: str | None
    level: str
    format: str
    uri: str
    size_bytes: int | None
    sha256: str | None
    summary: dict[str, Any]
    created_at: datetime
    updated_at: datetime
    created_by: str | None


class DataFileRead(DataFileFields):
    """A data file as returned by the API, with where it belongs and how many samples it holds."""

    project_code: str
    study_code: str
    assay_name: str | None
    sample_count: int


class DataFileSampleLink(BaseModel):
    """Links a sample to a data file, or changes its label there."""

    model_config = ConfigDict(extra="forbid")

    # Where this sample's data is within the file, e.g. a matrix column or TMT channel.
    label: str | None = Field(default=None, min_length=1, max_length=100)


class DataFileSampleRead(BaseModel):
    """A sample whose data is in a file, with its label there."""

    sample_id: uuid.UUID
    sample_name: str
    external_id: str | None
    material_type: str
    status: str
    label: str | None


class SampleDataFileRead(BaseModel):
    """A data file a sample appears in, with the sample's label there."""

    data_file_id: uuid.UUID
    name: str
    level: str
    format: str
    uri: str
    label: str | None


class SubjectDataFileRead(SampleDataFileRead):
    """A data file one of a subject's samples appears in, with which sample."""

    sample_id: uuid.UUID
    sample_name: str


class DataFileSummary(BaseModel):
    """Enough about a data file to list and link to it, e.g. as another file's input."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    level: str
    format: str
    uri: str
