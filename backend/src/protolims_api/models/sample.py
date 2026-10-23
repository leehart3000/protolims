"""Sample: physical material, with lineage (ISA Sample / Extract)."""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from protolims_api.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

SAMPLE_STATUSES = ("registered", "received", "in_storage", "in_use", "consumed", "disposed")


class Sample(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A tissue, extract, aliquot or treated culture.

    A sample's name is unique within its study only. Samples with the same name in
    different studies are separate records, connected only by explicit links.
    """

    __tablename__ = "sample"
    __table_args__ = (
        UniqueConstraint("study_id", "name"),
        CheckConstraint(
            "status IN (" + ", ".join(f"'{s}'" for s in SAMPLE_STATUSES) + ")",
            name="status",
        ),
    )

    study_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("study.id"))
    name: Mapped[str] = mapped_column(Text)
    # The sample's identifier in its source repository, e.g. a GDC sample UUID.
    external_id: Mapped[str | None] = mapped_column(Text, index=True)
    subject_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("subject.id"), index=True)
    parent_sample_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("sample.id"), index=True)
    material_type: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(Text, server_default=text("'registered'"))
    collected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    characteristics: Mapped[dict[str, Any]] = mapped_column(
        JSONB, server_default=text("'{}'::jsonb")
    )
    factor_values: Mapped[dict[str, Any]] = mapped_column(JSONB, server_default=text("'{}'::jsonb"))
