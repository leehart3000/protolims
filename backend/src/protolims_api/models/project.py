"""Project: the top-level grouping (ISA Investigation)."""

from sqlalchemy import Text
from sqlalchemy.orm import Mapped, mapped_column

from protolims_api.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Project(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A programme of work, e.g. TCGA or a PRIDE dataset."""

    __tablename__ = "project"

    code: Mapped[str] = mapped_column(Text, unique=True)
    name: Mapped[str] = mapped_column(Text)
    description: Mapped[str | None] = mapped_column(Text)
    source_repository: Mapped[str | None] = mapped_column(Text)
    licence: Mapped[str | None] = mapped_column(Text)
    citation: Mapped[str | None] = mapped_column(Text)
