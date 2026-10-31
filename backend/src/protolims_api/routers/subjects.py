"""Subject endpoints.

Subjects are created and listed under their study, and fetched by their permanent ID,
so links to a subject keep working even if its name is corrected.
"""

import uuid
from datetime import UTC, datetime
from typing import Annotated, Any, Literal

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import ColumnElement, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute

from protolims_api.audit import record_event
from protolims_api.conflicts import external_id_conflict, is_external_id_conflict
from protolims_api.db import SessionDep
from protolims_api.models import Project, Study, Subject
from protolims_api.permissions import (
    Actor,
    ActorDep,
    can_see_study,
    require_editor_of,
    require_study_role,
    visible_studies,
)
from protolims_api.routers.studies import get_study_or_404
from protolims_api.schemas.common import Page
from protolims_api.schemas.subject import SubjectCreate, SubjectFields, SubjectRead, SubjectUpdate

router = APIRouter(tags=["subjects"])

SubjectSort = Literal[
    "name",
    "-name",
    "subject_type",
    "-subject_type",
    "species",
    "-species",
    "created_at",
    "-created_at",
]

# What each sort key orders by. A leading "-" reverses the order.
SUBJECT_SORT_COLUMNS: dict[str, InstrumentedAttribute[Any]] = {
    "name": Subject.name,
    "subject_type": Subject.subject_type,
    "species": Subject.species,
    "created_at": Subject.created_at,
}

# A subject with its project and study codes.
SUBJECT_QUERY = (
    select(Subject, Project.code, Study.code)
    .join(Study, Subject.study_id == Study.id)
    .join(Project, Study.project_id == Project.id)
)


def subject_read(subject: Subject, project_code: str, study_code: str) -> SubjectRead:
    return SubjectRead(
        **SubjectFields.model_validate(subject).model_dump(),
        project_code=project_code,
        study_code=study_code,
    )


@router.post(
    "/projects/{project_code}/studies/{study_code}/subjects",
    status_code=status.HTTP_201_CREATED,
)
async def create_subject(
    project_code: str,
    study_code: str,
    payload: SubjectCreate,
    session: SessionDep,
    actor: ActorDep,
) -> SubjectRead:
    """Create a subject within a study. Subject names are unique within their study."""
    study = await get_study_or_404(session, project_code, study_code, actor)
    await require_study_role(session, actor, study, "editor")
    subject = Subject(study_id=study.id, created_by=actor.label, **payload.model_dump())
    session.add(subject)
    try:
        await session.flush()
    except IntegrityError as exc:
        await session.rollback()
        if is_external_id_conflict(exc):
            raise external_id_conflict(
                "subject", payload.external_id, f"in study {study_code!r}"
            ) from exc
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Subject {payload.name!r} already exists in study {study_code!r}",
        ) from exc
    await record_event(
        session,
        action="create",
        entity_type="subject",
        entity_id=subject.id,
        actor=actor.label,
        changes={
            "after": {
                "project": project_code,
                "study": study_code,
                **payload.model_dump(mode="json"),
            }
        },
    )
    await session.commit()
    await session.refresh(subject)
    return subject_read(subject, project_code, study_code)


@router.get("/projects/{project_code}/studies/{study_code}/subjects")
async def list_subjects(
    project_code: str,
    study_code: str,
    session: SessionDep,
    actor: ActorDep,
    q: Annotated[
        str | None,
        Query(max_length=200, description="Search subject names and external IDs, ignoring case"),
    ] = None,
    sort: Annotated[
        SubjectSort, Query(description="The column to sort by; a leading - reverses the order")
    ] = "name",
    limit: Annotated[int, Query(ge=1, le=500)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> Page[SubjectRead]:
    """List a study's subjects a page at a time, with the total number that match."""
    study = await get_study_or_404(session, project_code, study_code, actor)
    return await subject_page(session, [Subject.study_id == study.id], q, sort, limit, offset)


@router.get("/subjects")
async def list_all_subjects(
    session: SessionDep,
    actor: ActorDep,
    q: Annotated[
        str | None,
        Query(max_length=200, description="Search subject names and external IDs, ignoring case"),
    ] = None,
    sort: Annotated[
        SubjectSort, Query(description="The column to sort by; a leading - reverses the order")
    ] = "name",
    limit: Annotated[int, Query(ge=1, le=500)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> Page[SubjectRead]:
    """List the subjects in the studies the actor can see, across all projects, a page at a
    time, with the total number that match."""
    return await subject_page(session, [visible_studies(actor)], q, sort, limit, offset)


async def subject_page(
    session: AsyncSession,
    conditions: list[ColumnElement[bool]],
    q: str | None,
    sort: SubjectSort,
    limit: int,
    offset: int,
) -> Page[SubjectRead]:
    """One page of the subjects that match the conditions (on Subject or Study) and search."""
    if q:
        conditions.append(
            or_(
                Subject.name.icontains(q, autoescape=True),
                Subject.external_id.icontains(q, autoescape=True),
            )
        )
    count_query = (
        select(func.count())
        .select_from(Subject)
        .join(Study, Subject.study_id == Study.id)
        .where(*conditions)
    )
    total = (await session.execute(count_query)).scalar_one()

    column = SUBJECT_SORT_COLUMNS[sort.removeprefix("-")]
    order = column.desc() if sort.startswith("-") else column.asc()
    result = await session.execute(
        SUBJECT_QUERY.where(*conditions)
        .order_by(order.nulls_last(), Subject.name, Subject.id)
        .limit(limit)
        .offset(offset)
    )
    return Page[SubjectRead](
        items=[
            subject_read(subject, project_code, study_code)
            for subject, project_code, study_code in result
        ],
        total=total,
    )


@router.get("/subjects/{subject_id}")
async def get_subject(subject_id: uuid.UUID, session: SessionDep, actor: ActorDep) -> SubjectRead:
    """Get one subject by its permanent ID."""
    query = SUBJECT_QUERY.where(Subject.id == subject_id, visible_studies(actor))
    row = (await session.execute(query)).one_or_none()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Subject {subject_id} not found",
        )
    subject, project_code, study_code = row
    return subject_read(subject, project_code, study_code)


async def get_subject_or_404(session: AsyncSession, subject_id: uuid.UUID, actor: Actor) -> Subject:
    """Find a subject, or respond with 404. One in a study the actor can't see is not found."""
    subject = await session.get(Subject, subject_id)
    if subject is None or not await can_see_study(session, actor, subject.study_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Subject {subject_id} not found",
        )
    return subject


@router.patch("/subjects/{subject_id}")
async def update_subject(
    subject_id: uuid.UUID, payload: SubjectUpdate, session: SessionDep, actor: ActorDep
) -> SubjectRead:
    """Change some of a subject's details. Only the fields sent are changed; null clears one."""
    subject = await get_subject_or_404(session, subject_id, actor)
    await require_editor_of(session, actor, subject.study_id)

    requested = payload.model_dump(exclude_unset=True)
    changed = {
        field: value for field, value in requested.items() if getattr(subject, field) != value
    }
    if changed:
        before = SubjectFields.model_validate(subject).model_dump(mode="json")
        for field, value in changed.items():
            setattr(subject, field, value)
        subject.updated_at = datetime.now(UTC)
        try:
            await session.flush()
        except IntegrityError as exc:
            await session.rollback()
            if is_external_id_conflict(exc):
                raise external_id_conflict("subject", payload.external_id, "in this study") from exc
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Subject {payload.name!r} already exists in this study",
            ) from exc
        await record_event(
            session,
            action="update",
            entity_type="subject",
            entity_id=subject.id,
            actor=actor.label,
            changes={
                "before": {field: before[field] for field in changed},
                "after": payload.model_dump(mode="json", include=set(changed)),
            },
        )
        await session.commit()

    row = (await session.execute(SUBJECT_QUERY.where(Subject.id == subject_id))).one()
    updated, project_code, study_code = row
    return subject_read(updated, project_code, study_code)
