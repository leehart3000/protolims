"""Subject: where material came from (ISA Source)."""

import uuid
from typing import Any

from sqlalchemy import CheckConstraint, ForeignKey, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from protolims_api.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

SUBJECT_TYPES = ("patient", "cell_line", "organism", "other")


class Subject(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A patient, cell line or organism that provides samples.

    A subject's name is unique within its study only. Subjects with the same name in
    different studies are separate records, connected only by explicit links.
    """

    __tablename__ = "subject"
    # The unique constraint's index starts with study_id, so it also speeds up
    # "all subjects in this study" queries; a separate study_id index isn't needed.
    __table_args__ = (
        UniqueConstraint("study_id", "name"),
        CheckConstraint(
            "subject_type IN (" + ", ".join(f"'{t}'" for t in SUBJECT_TYPES) + ")",
            name="subject_type",
        ),
    )

    study_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("study.id"))
    name: Mapped[str] = mapped_column(Text)
    # The subject's identifier in its source repository, e.g. a GDC case UUID.
    external_id: Mapped[str | None] = mapped_column(Text, index=True)
    subject_type: Mapped[str] = mapped_column(Text)
    species: Mapped[str | None] = mapped_column(Text)
    attributes: Mapped[dict[str, Any]] = mapped_column(JSONB, server_default=text("'{}'::jsonb"))
