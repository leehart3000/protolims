"""People who sign in, their sessions, and sign-ins in progress."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from protolims_api.models.base import Base, UUIDPrimaryKeyMixin


class AppUser(UUIDPrimaryKeyMixin, Base):
    """Someone who has signed in. ("user" is a reserved word in PostgreSQL.)

    They're identified by who vouched for them (provider, e.g. "orcid") and that provider's ID
    for them (subject, e.g. an ORCID iD), never by name or email.
    """

    __tablename__ = "app_user"
    __table_args__ = (UniqueConstraint("provider", "subject"),)

    provider: Mapped[str] = mapped_column(Text)
    subject: Mapped[str] = mapped_column(Text)
    # As the provider gave it at the last sign-in, if they shared it.
    name: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    # Null for someone added by their ORCID iD who hasn't signed in yet.
    last_signed_in_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class UserSession(UUIDPrimaryKeyMixin, Base):
    """A signed-in browser. Only a hash of its cookie is stored, so a copy of the database
    can't be used to sign in. Deleting the row signs that browser out."""

    __tablename__ = "user_session"

    token_hash: Mapped[str] = mapped_column(Text, unique=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app_user.id", ondelete="CASCADE"), index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class SignInAttempt(Base):
    """A sign-in that has gone to ORCID and not come back yet. It's used once, and only for a
    few minutes, so a sign-in can't be replayed or started by another site."""

    __tablename__ = "sign_in_attempt"

    # A hash of the random "state" sent to ORCID and kept in a cookie.
    state_hash: Mapped[str] = mapped_column(Text, primary_key=True)
    # Must come back inside ORCID's ID token, tying the token to this sign-in.
    nonce: Mapped[str] = mapped_column(Text)
    # The page on this site to go back to afterwards.
    return_to: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
