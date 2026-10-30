"""index audit events by actor

Revision ID: 5d2e7a1c9b04
Revises: 8acca8cbe3a5
Create Date: 2026-10-30 18:15:00.000000

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "5d2e7a1c9b04"
down_revision: str | Sequence[str] | None = "8acca8cbe3a5"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    # For listing what someone has done, newest first (their profile page's activity).
    op.create_index("ix_audit_event_actor", "audit_event", ["actor", "occurred_at"], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("ix_audit_event_actor", table_name="audit_event")
