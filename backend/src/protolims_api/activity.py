"""What someone has done: their changes from the audit trail, with what each was made to."""

import uuid
from collections import defaultdict
from collections.abc import Sequence
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from protolims_api.models import (
    Assay,
    AuditEvent,
    DataFile,
    Project,
    Sample,
    Study,
    Subject,
)
from protolims_api.permissions import Actor, visible_projects, visible_studies
from protolims_api.schemas.common import Page
from protolims_api.schemas.user import ActivityRead

# The records that belong to a study, by their audit trail entity_type.
STUDY_RECORDS: dict[str, Any] = {
    "subject": Subject,
    "sample": Sample,
    "assay": Assay,
    "data_file": DataFile,
}

# What a change was made to, as it is now: its name, project code and study code.
Description = tuple[str, str, str | None]


async def describe(
    session: AsyncSession, actor: Actor, events: Sequence[AuditEvent]
) -> dict[tuple[str, uuid.UUID], Description]:
    """Name what each event was made to, if it still exists and the actor can see it."""
    ids: defaultdict[str, set[uuid.UUID]] = defaultdict(set)
    for event in events:
        ids[event.entity_type].add(event.entity_id)
    found: dict[tuple[str, uuid.UUID], Description] = {}

    if ids["project"]:
        projects = await session.execute(
            select(Project.id, Project.name, Project.code).where(
                Project.id.in_(ids["project"]), visible_projects(actor)
            )
        )
        for project_id, name, code in projects:
            found[("project", project_id)] = (name, code, None)

    if ids["study"]:
        studies = await session.execute(
            select(Study.id, Study.title, Project.code, Study.code)
            .join(Project, Study.project_id == Project.id)
            .where(Study.id.in_(ids["study"]), visible_studies(actor))
        )
        for study_id, title, project_code, study_code in studies:
            found[("study", study_id)] = (title, project_code, study_code)

    for entity_type, model in STUDY_RECORDS.items():
        if not ids[entity_type]:
            continue
        records = await session.execute(
            select(model.id, model.name, Project.code, Study.code)
            .join(Study, model.study_id == Study.id)
            .join(Project, Study.project_id == Project.id)
            .where(model.id.in_(ids[entity_type]), visible_studies(actor))
        )
        for record_id, name, project_code, study_code in records:
            found[(entity_type, record_id)] = (name, project_code, study_code)

    return found


def activity_read(event: AuditEvent, description: Description | None) -> ActivityRead:
    # Changes to roles, and removing someone, name the person in the change itself.
    after = event.changes.get("after") or {}
    before = event.changes.get("before") or {}
    person = after.get("orcid") or before.get("orcid")
    name, project_code, study_code = description or (None, None, None)
    return ActivityRead(
        occurred_at=event.occurred_at,
        action=event.action,
        entity_type=event.entity_type,
        entity_id=event.entity_id,
        name=name,
        project_code=project_code,
        study_code=study_code,
        person=person,
        role=after.get("role") if event.action in ("set_member", "remove_member") else None,
    )


async def activity_page(
    session: AsyncSession, actor: Actor, limit: int, offset: int
) -> Page[ActivityRead]:
    """One page of the actor's changes, newest first, with the total number."""
    mine = AuditEvent.actor == actor.label
    count_query = select(func.count()).select_from(AuditEvent).where(mine)
    total = (await session.execute(count_query)).scalar_one()
    events = (
        await session.scalars(
            select(AuditEvent)
            .where(mine)
            .order_by(AuditEvent.occurred_at.desc(), AuditEvent.id.desc())
            .limit(limit)
            .offset(offset)
        )
    ).all()
    found = await describe(session, actor, events)
    return Page[ActivityRead](
        items=[
            activity_read(event, found.get((event.entity_type, event.entity_id)))
            for event in events
        ],
        total=total,
    )
