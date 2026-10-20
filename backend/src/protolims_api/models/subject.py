"""Subject: where material came from (ISA Source)."""

import uuid
from typing import Any

from sqlalchemy import CheckConstraint, ForeignKey, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from protolims_api.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

SUBJECT_TYPES = ("patient", "cell_line", "organism", "other")


class Subject(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A patient, cell line or organism that provides samples."""

    __tablename__ = "subject"
    __table_args__ = (
        UniqueConstraint("study_id", "external_id"),
        CheckConstraint(
            "subject_type IN (" + ", ".join(f"'{t}'" for t in SUBJECT_TYPES) + ")",
            name="subject_type",
        ),
    )

    study_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("study.id"), index=True)
    external_id: Mapped[str] = mapped_column(Text)
    subject_type: Mapped[str] = mapped_column(Text)
    species: Mapped[str | None] = mapped_column(Text)
    attributes: Mapped[dict[str, Any]] = mapped_column(JSONB, server_default=text("'{}'::jsonb"))
