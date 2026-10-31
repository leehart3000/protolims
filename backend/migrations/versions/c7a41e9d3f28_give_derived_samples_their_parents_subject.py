"""give derived samples their parent's subject

Revision ID: c7a41e9d3f28
Revises: 9b3f6c2d8e15
Create Date: 2026-10-31 12:10:00.000000

A derived sample (one with a parent) now always has its parent's subject. This sets it for the
samples already stored, recording each change in the audit trail. There's nothing to undo: the
old values were gaps, not data.
"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c7a41e9d3f28"
down_revision: str | Sequence[str] | None = "9b3f6c2d8e15"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Each derived sample, with the subject of the sample at the top of its chain of parents.
SUBJECTS_FROM_THE_TOP = """
    WITH RECURSIVE chain AS (
        SELECT id, subject_id AS top_subject_id
        FROM sample
        WHERE parent_sample_id IS NULL
        UNION ALL
        SELECT child.id, chain.top_subject_id
        FROM sample AS child
        JOIN chain ON child.parent_sample_id = chain.id
    )
"""


def upgrade() -> None:
    """Upgrade schema."""
    op.execute(
        SUBJECTS_FROM_THE_TOP
        + """
        INSERT INTO audit_event (actor, action, entity_type, entity_id, changes)
        SELECT
            'migration:c7a41e9d3f28',
            'update',
            'sample',
            sample.id,
            jsonb_build_object(
                'before', jsonb_build_object('subject_id', sample.subject_id),
                'after', jsonb_build_object('subject_id', chain.top_subject_id),
                'reason', 'a derived sample has its parent sample''s subject'
            )
        FROM sample
        JOIN chain ON chain.id = sample.id
        WHERE sample.parent_sample_id IS NOT NULL
          AND sample.subject_id IS DISTINCT FROM chain.top_subject_id
        """
    )
    op.execute(
        SUBJECTS_FROM_THE_TOP
        + """
        UPDATE sample
        SET subject_id = chain.top_subject_id, updated_at = now()
        FROM chain
        WHERE chain.id = sample.id
          AND sample.parent_sample_id IS NOT NULL
          AND sample.subject_id IS DISTINCT FROM chain.top_subject_id
        """
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Nothing to undo: see above.
