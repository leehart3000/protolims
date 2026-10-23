"""name unique constraints after all their columns

Revision ID: 135134a89539
Revises: 438e54e09516
Create Date: 2026-10-23 18:51:23.729225

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "135134a89539"
down_revision: str | Sequence[str] | None = "438e54e09516"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# (table, old name, new name)
RENAMES = [
    ("study", "uq_study_project_id", "uq_study_project_id_code"),
    ("subject", "uq_subject_study_id", "uq_subject_study_id_external_id"),
    ("sample", "uq_sample_study_id", "uq_sample_study_id_name"),
]


def upgrade() -> None:
    """Name multi-column unique constraints after all their columns."""
    for table, old, new in RENAMES:
        op.execute(f"ALTER TABLE {table} RENAME CONSTRAINT {old} TO {new}")


def downgrade() -> None:
    """Restore the old, first-column-only names."""
    for table, old, new in RENAMES:
        op.execute(f"ALTER TABLE {table} RENAME CONSTRAINT {new} TO {old}")
