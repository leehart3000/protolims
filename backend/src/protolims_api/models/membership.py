"""Who has which role on a project or a study."""

import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from protolims_api.models.base import Base

ROLE_CHECK = "role IN ('viewer', 'editor', 'admin')"


class ProjectMember(Base):
    """A role on a project, which also covers all of its studies."""

    __tablename__ = "project_member"
    __table_args__ = (CheckConstraint(ROLE_CHECK, name="role"),)

    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("project.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app_user.id", ondelete="CASCADE"), primary_key=True, index=True
    )
    role: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    created_by: Mapped[str | None] = mapped_column(Text)


class StudyMember(Base):
    """A role on one study. Someone's role on a study is the higher of this and their
    project role."""

    __tablename__ = "study_member"
    __table_args__ = (CheckConstraint(ROLE_CHECK, name="role"),)

    study_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("study.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app_user.id", ondelete="CASCADE"), primary_key=True, index=True
    )
    role: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    created_by: Mapped[str | None] = mapped_column(Text)
