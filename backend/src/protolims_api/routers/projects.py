"""Project endpoints."""

from datetime import UTC, datetime
from typing import Annotated, Any, Literal

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import ColumnElement, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute

from protolims_api.audit import record_event
from protolims_api.db import SessionDep
from protolims_api.models import Project
from protolims_api.permissions import (
    Actor,
    ActorDep,
    require_project_role,
    require_site_admin,
    visible_projects,
)
from protolims_api.schemas.common import Page
from protolims_api.schemas.project import ProjectCreate, ProjectRead, ProjectUpdate

router = APIRouter(prefix="/projects", tags=["projects"])

ProjectSort = Literal["code", "-code", "name", "-name", "created_at", "-created_at"]

# What each sort key orders by. A leading "-" reverses the order.
PROJECT_SORT_COLUMNS: dict[str, InstrumentedAttribute[Any]] = {
    "code": Project.code,
    "name": Project.name,
    "created_at": Project.created_at,
}


async def get_project_or_404(session: AsyncSession, code: str, actor: Actor) -> Project:
    """Find a project by code, or stop the request with 404 Not Found. A project the actor
    can't see is not found, too."""
    project = await session.scalar(
        select(Project).where(Project.code == code, visible_projects(actor))
    )
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project {code!r} not found",
        )
    return project


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_project(
    payload: ProjectCreate, session: SessionDep, actor: ActorDep
) -> ProjectRead:
    """Create a project. Only site administrators can."""
    require_site_admin(actor)
    project = Project(**payload.model_dump(), created_by=actor.label)
    session.add(project)
    try:
        await session.flush()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Project code {payload.code!r} already exists",
        ) from exc
    await record_event(
        session,
        action="create",
        entity_type="project",
        entity_id=project.id,
        actor=actor.label,
        changes={"after": payload.model_dump(mode="json")},
    )
    await session.commit()
    await session.refresh(project)
    return ProjectRead.model_validate(project)


@router.get("")
async def list_projects(
    session: SessionDep,
    actor: ActorDep,
    q: Annotated[
        str | None,
        Query(max_length=200, description="Search project codes and names, ignoring case"),
    ] = None,
    sort: Annotated[
        ProjectSort, Query(description="The column to sort by; a leading - reverses the order")
    ] = "code",
    limit: Annotated[int, Query(ge=1, le=500)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> Page[ProjectRead]:
    """List the projects the actor can see a page at a time, with the total number that
    match."""
    conditions: list[ColumnElement[bool]] = [visible_projects(actor)]
    if q:
        conditions.append(
            or_(
                Project.code.icontains(q, autoescape=True),
                Project.name.icontains(q, autoescape=True),
            )
        )
    count_query = select(func.count()).select_from(Project).where(*conditions)
    total = (await session.execute(count_query)).scalar_one()

    column = PROJECT_SORT_COLUMNS[sort.removeprefix("-")]
    order = column.desc() if sort.startswith("-") else column.asc()
    result = await session.scalars(
        select(Project).where(*conditions).order_by(order, Project.code).limit(limit).offset(offset)
    )
    return Page[ProjectRead](
        items=[ProjectRead.model_validate(project) for project in result], total=total
    )


@router.get("/{code}")
async def get_project(code: str, session: SessionDep, actor: ActorDep) -> ProjectRead:
    """Get one project by its code."""
    return ProjectRead.model_validate(await get_project_or_404(session, code, actor))


@router.patch("/{code}")
async def update_project(
    code: str, payload: ProjectUpdate, session: SessionDep, actor: ActorDep
) -> ProjectRead:
    """Change some of a project's details. Only the fields sent are changed; null clears one.

    Only the project's admins (and site administrators) can.
    """
    project = await get_project_or_404(session, code, actor)
    await require_project_role(session, actor, project.id, "admin")

    requested = payload.model_dump(exclude_unset=True)
    changed = {
        field: value for field, value in requested.items() if getattr(project, field) != value
    }
    if changed:
        before = ProjectRead.model_validate(project).model_dump(mode="json")
        for field, value in changed.items():
            setattr(project, field, value)
        project.updated_at = datetime.now(UTC)
        await record_event(
            session,
            action="update",
            entity_type="project",
            entity_id=project.id,
            actor=actor.label,
            changes={
                "before": {field: before[field] for field in changed},
                "after": payload.model_dump(mode="json", include=set(changed)),
            },
        )
        await session.commit()
        await session.refresh(project)

    return ProjectRead.model_validate(project)
