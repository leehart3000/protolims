"""Study endpoints."""

from datetime import UTC, datetime
from typing import Annotated, Any, Literal

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import ColumnElement, UnaryExpression, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute

from protolims_api.audit import record_event
from protolims_api.db import SessionDep
from protolims_api.models import Project, Study
from protolims_api.permissions import ActorDep, require_project_role, require_study_role
from protolims_api.routers.projects import get_project_or_404
from protolims_api.schemas.common import Page
from protolims_api.schemas.study import (
    StudyCreate,
    StudyRead,
    StudyUpdate,
    StudyWithProjectRead,
)

router = APIRouter(tags=["studies"])

StudySort = Literal["code", "-code", "title", "-title", "created_at", "-created_at"]
AllStudySort = Literal[
    "project", "-project", "code", "-code", "title", "-title", "created_at", "-created_at"
]

# What each sort key orders by. A leading "-" reverses the order.
STUDY_SORT_COLUMNS: dict[str, InstrumentedAttribute[Any]] = {
    "project": Project.code,
    "code": Study.code,
    "title": Study.title,
    "created_at": Study.created_at,
}


def study_search(q: str) -> ColumnElement[bool]:
    """Match studies whose code or title contains q, ignoring case."""
    return or_(Study.code.icontains(q, autoescape=True), Study.title.icontains(q, autoescape=True))


def study_order(sort: str) -> UnaryExpression[Any]:
    """The ORDER BY for a sort key; a leading "-" reverses it."""
    column = STUDY_SORT_COLUMNS[sort.removeprefix("-")]
    return column.desc() if sort.startswith("-") else column.asc()


@router.post("/projects/{project_code}/studies", status_code=status.HTTP_201_CREATED)
async def create_study(
    project_code: str, payload: StudyCreate, session: SessionDep, actor: ActorDep
) -> StudyRead:
    """Create a study within a project. Study codes are unique within their project.

    Only the project's admins (and site administrators) can.
    """
    project = await get_project_or_404(session, project_code)
    await require_project_role(session, actor, project.id, "admin")
    study = Study(project_id=project.id, created_by=actor.label, **payload.model_dump())
    session.add(study)
    try:
        await session.flush()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Study code {payload.code!r} already exists in project {project_code!r}",
        ) from exc
    await record_event(
        session,
        action="create",
        entity_type="study",
        entity_id=study.id,
        actor=actor.label,
        changes={"after": {"project": project_code, **payload.model_dump(mode="json")}},
    )
    await session.commit()
    await session.refresh(study)
    return StudyRead.model_validate(study)


@router.get("/projects/{project_code}/studies")
async def list_studies(
    project_code: str,
    session: SessionDep,
    q: Annotated[
        str | None,
        Query(max_length=200, description="Search study codes and titles, ignoring case"),
    ] = None,
    sort: Annotated[
        StudySort, Query(description="The column to sort by; a leading - reverses the order")
    ] = "code",
    limit: Annotated[int, Query(ge=1, le=500)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> Page[StudyRead]:
    """List a project's studies a page at a time, with the total number that match."""
    project = await get_project_or_404(session, project_code)
    conditions: list[ColumnElement[bool]] = [Study.project_id == project.id]
    if q:
        conditions.append(study_search(q))
    count_query = select(func.count()).select_from(Study).where(*conditions)
    total = (await session.execute(count_query)).scalar_one()

    result = await session.scalars(
        select(Study)
        .where(*conditions)
        .order_by(study_order(sort), Study.code)
        .limit(limit)
        .offset(offset)
    )
    return Page[StudyRead](items=[StudyRead.model_validate(study) for study in result], total=total)


async def get_study_or_404(session: AsyncSession, project_code: str, study_code: str) -> Study:
    """Find a study by its project's code and its own code, or respond with 404."""
    project = await get_project_or_404(session, project_code)
    study = await session.scalar(
        select(Study).where(Study.project_id == project.id, Study.code == study_code)
    )
    if study is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Study {study_code!r} not found in project {project_code!r}",
        )
    return study


@router.get("/projects/{project_code}/studies/{study_code}")
async def get_study(project_code: str, study_code: str, session: SessionDep) -> StudyRead:
    """Get one study by its project's code and its own code."""
    return StudyRead.model_validate(await get_study_or_404(session, project_code, study_code))


@router.patch("/projects/{project_code}/studies/{study_code}")
async def update_study(
    project_code: str, study_code: str, payload: StudyUpdate, session: SessionDep, actor: ActorDep
) -> StudyRead:
    """Change a study's title, description or design factors. Only the fields sent change.

    The study's editors and admins can.
    """
    study = await get_study_or_404(session, project_code, study_code)
    await require_study_role(session, actor, study, "editor")

    requested = payload.model_dump(exclude_unset=True)
    changed = {field: value for field, value in requested.items() if getattr(study, field) != value}
    if changed:
        before = StudyRead.model_validate(study).model_dump(mode="json")
        for field, value in changed.items():
            setattr(study, field, value)
        study.updated_at = datetime.now(UTC)
        await record_event(
            session,
            action="update",
            entity_type="study",
            entity_id=study.id,
            actor=actor.label,
            changes={
                "before": {field: before[field] for field in changed},
                "after": payload.model_dump(mode="json", include=set(changed)),
            },
        )
        await session.commit()
        await session.refresh(study)

    return StudyRead.model_validate(study)


@router.get("/studies")
async def list_all_studies(
    session: SessionDep,
    project: Annotated[
        str | None, Query(description="Only list studies in the project with this code")
    ] = None,
    q: Annotated[
        str | None,
        Query(
            max_length=200,
            description="Search study codes and titles, and project codes, ignoring case",
        ),
    ] = None,
    sort: Annotated[
        AllStudySort, Query(description="The column to sort by; a leading - reverses the order")
    ] = "project",
    limit: Annotated[int, Query(ge=1, le=500)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> Page[StudyWithProjectRead]:
    """List studies across all projects a page at a time, with the total number that match."""
    conditions: list[ColumnElement[bool]] = []
    if project is not None:
        conditions.append(Project.code == project)
    if q:
        conditions.append(or_(study_search(q), Project.code.icontains(q, autoescape=True)))
    count_query = (
        select(func.count())
        .select_from(Study)
        .join(Project, Study.project_id == Project.id)
        .where(*conditions)
    )
    total = (await session.execute(count_query)).scalar_one()

    result = await session.execute(
        select(Study, Project.code, Project.name)
        .join(Project, Study.project_id == Project.id)
        .where(*conditions)
        .order_by(study_order(sort), Project.code, Study.code)
        .limit(limit)
        .offset(offset)
    )
    return Page[StudyWithProjectRead](
        items=[
            StudyWithProjectRead(
                **StudyRead.model_validate(study).model_dump(),
                project_code=project_code,
                project_name=project_name,
            )
            for study, project_code, project_name in result
        ],
        total=total,
    )
