"""Data files, the samples they contain, and their derivation links."""

import uuid
from typing import Any

from sqlalchemy import BigInteger, CheckConstraint, ForeignKey, Text, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from protolims_api.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

DATA_FILE_LEVELS = ("raw", "processed", "analysis")


class DataFile(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A file in object storage: raw data, processed data or analysis output."""

    __tablename__ = "data_file"
    __table_args__ = (
        CheckConstraint(
            "level IN (" + ", ".join(f"'{v}'" for v in DATA_FILE_LEVELS) + ")",
            name="level",
        ),
    )

    study_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("study.id"), index=True)
    assay_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("assay.id"), index=True)
    name: Mapped[str] = mapped_column(Text)
    external_id: Mapped[str | None] = mapped_column(Text, index=True)
    level: Mapped[str] = mapped_column(Text)
    format: Mapped[str] = mapped_column(Text)
    uri: Mapped[str] = mapped_column(Text, unique=True)
    size_bytes: Mapped[int | None] = mapped_column(BigInteger)
    sha256: Mapped[str | None] = mapped_column(Text)
    summary: Mapped[dict[str, Any]] = mapped_column(JSONB, server_default=text("'{}'::jsonb"))


class DataFileSample(TimestampMixin, Base):
    """Links a data file to a sample whose data it contains."""

    __tablename__ = "data_file_sample"

    data_file_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("data_file.id"), primary_key=True)
    sample_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("sample.id"), primary_key=True, index=True
    )
    # Where this sample's data is within the file, e.g. a TMT channel or matrix column.
    label: Mapped[str | None] = mapped_column(Text)


class DataFileInput(TimestampMixin, Base):
    """Records that one data file was derived from another."""

    __tablename__ = "data_file_input"
    __table_args__ = (CheckConstraint("data_file_id <> input_data_file_id", name="not_self"),)

    data_file_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("data_file.id"), primary_key=True)
    input_data_file_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("data_file.id"), primary_key=True, index=True
    )
