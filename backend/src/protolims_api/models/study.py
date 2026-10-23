"""Study: a unit of research within a project (ISA Study)."""

import uuid
from typing import Any

from sqlalchemy import ForeignKey, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from protolims_api.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Study(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A study, e.g. RNA-seq of a cohort, with its design factors.

    Study codes are unique within their project, so different projects can reuse a code.
    """

    __tablename__ = "study"
    # The unique constraint's index starts with project_id, so it also speeds up
    # "all studies in this project" queries; a separate project_id index isn't needed.
    __table_args__ = (UniqueConstraint("project_id", "code"),)

    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("project.id"))
    code: Mapped[str] = mapped_column(Text)
    title: Mapped[str] = mapped_column(Text)
    description: Mapped[str | None] = mapped_column(Text)
    design_factors: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB, server_default=text("'[]'::jsonb")
    )
