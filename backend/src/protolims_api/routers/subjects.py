"""Subject endpoints.

Subjects are created and listed under their study, and fetched by their permanent ID,
so links to a subject keep working even if its name is corrected.
"""

import uuid
from typing import Annotated, Any, Literal

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import ColumnElement, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import InstrumentedAttribute

from protolims_api.audit import record_event
from protolims_api.db import SessionDep
from protolims_api.models import Project, Study, Subject
from protolims_api.routers.studies import get_study_or_404
from protolims_api.schemas.common import Page
from protolims_api.schemas.subject import SubjectCreate, SubjectFields, SubjectRead

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
    project_code: str, study_code: str, payload: SubjectCreate, session: SessionDep
) -> SubjectRead:
    """Create a subject within a study. Subject names are unique within their study."""
    study = await get_study_or_404(session, project_code, study_code)
    subject = Subject(study_id=study.id, **payload.model_dump())
    session.add(subject)
    try:
        await session.flush()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Subject {payload.name!r} already exists in study {study_code!r}",
        ) from exc
    await record_event(
        session,
        action="create",
        entity_type="subject",
        entity_id=subject.id,
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
    study = await get_study_or_404(session, project_code, study_code)
    conditions: list[ColumnElement[bool]] = [Subject.study_id == study.id]
    if q:
        conditions.append(
            or_(
                Subject.name.icontains(q, autoescape=True),
                Subject.external_id.icontains(q, autoescape=True),
            )
        )
    count_query = select(func.count()).select_from(Subject).where(*conditions)
    total = (await session.execute(count_query)).scalar_one()

    column = SUBJECT_SORT_COLUMNS[sort.removeprefix("-")]
    order = column.desc() if sort.startswith("-") else column.asc()
    result = await session.scalars(
        select(Subject)
        .where(*conditions)
        .order_by(order.nulls_last(), Subject.name, Subject.id)
        .limit(limit)
        .offset(offset)
    )
    return Page[SubjectRead](
        items=[subject_read(subject, project_code, study_code) for subject in result],
        total=total,
    )


@router.get("/subjects/{subject_id}")
async def get_subject(subject_id: uuid.UUID, session: SessionDep) -> SubjectRead:
    """Get one subject by its permanent ID."""
    row = (
        await session.execute(
            select(Subject, Project.code, Study.code)
            .join(Study, Subject.study_id == Study.id)
            .join(Project, Study.project_id == Project.id)
            .where(Subject.id == subject_id)
        )
    ).one_or_none()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Subject {subject_id} not found",
        )
    subject, project_code, study_code = row
    return subject_read(subject, project_code, study_code)
