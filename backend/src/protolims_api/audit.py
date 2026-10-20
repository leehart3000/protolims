"""Recording audit events."""

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from protolims_api.models import AuditEvent


async def record_event(
    session: AsyncSession,
    *,
    action: str,
    entity_type: str,
    entity_id: uuid.UUID,
    changes: dict[str, Any],
    actor: str | None = None,
) -> None:
    """Add an audit event to the current transaction.

    The event is saved only if the change it describes is saved, so the
    audit trail can never disagree with the data.
    """
    session.add(
        AuditEvent(
            actor=actor,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            changes=changes,
        )
    )
