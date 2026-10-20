"""Study: a unit of research within a project (ISA Study)."""

import uuid
from typing import Any

from sqlalchemy import ForeignKey, Text, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from protolims_api.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Study(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A study, e.g. TCGA-BRCA, with its design factors."""

    __tablename__ = "study"

    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("project.id"), index=True)
    code: Mapped[str] = mapped_column(Text, unique=True)
    title: Mapped[str] = mapped_column(Text)
    description: Mapped[str | None] = mapped_column(Text)
    design_factors: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB, server_default=text("'[]'::jsonb")
    )
