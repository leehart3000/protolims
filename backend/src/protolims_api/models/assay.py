"""Assay: a set of measurements on samples (ISA Assay)."""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from protolims_api.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Assay(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A measurement run, e.g. an RNA-seq batch or an LC-MS/MS experiment.

    An assay's name is unique within its study only.
    """

    __tablename__ = "assay"
    # The unique constraint's index starts with study_id, so it also speeds up
    # "all assays in this study" queries; a separate study_id index isn't needed.
    __table_args__ = (UniqueConstraint("study_id", "name"),)

    study_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("study.id"))
    name: Mapped[str] = mapped_column(Text)
    external_id: Mapped[str | None] = mapped_column(Text, index=True)
    measurement_type: Mapped[str] = mapped_column(Text)
    technology_type: Mapped[str] = mapped_column(Text)
    platform: Mapped[str | None] = mapped_column(Text)
    performed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    parameters: Mapped[dict[str, Any]] = mapped_column(JSONB, server_default=text("'{}'::jsonb"))


class AssaySample(TimestampMixin, Base):
    """Links a sample to an assay it was measured in."""

    __tablename__ = "assay_sample"

    assay_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("assay.id"), primary_key=True)
    sample_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("sample.id"), primary_key=True, index=True
    )
    label: Mapped[str | None] = mapped_column(Text)
