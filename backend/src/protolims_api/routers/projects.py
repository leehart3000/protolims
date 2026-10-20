"""Project endpoints."""

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from protolims_api.audit import record_event
from protolims_api.db import SessionDep
from protolims_api.models import Project
from protolims_api.schemas.project import ProjectCreate, ProjectRead

router = APIRouter(prefix="/projects", tags=["projects"])


async def get_project_or_404(session: AsyncSession, code: str) -> Project:
    """Find a project by code, or stop the request with 404 Not Found."""
    project = await session.scalar(select(Project).where(Project.code == code))
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project {code!r} not found",
        )
    return project


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_project(payload: ProjectCreate, session: SessionDep) -> ProjectRead:
    """Create a project."""
    project = Project(**payload.model_dump())
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
        changes={"after": payload.model_dump(mode="json")},
    )
    await session.commit()
    await session.refresh(project)
    return ProjectRead.model_validate(project)


@router.get("")
async def list_projects(
    session: SessionDep,
    limit: Annotated[int, Query(ge=1, le=500)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[ProjectRead]:
    """List projects, ordered by code."""
    result = await session.scalars(
        select(Project).order_by(Project.code).limit(limit).offset(offset)
    )
    return [ProjectRead.model_validate(project) for project in result]


@router.get("/{code}")
async def get_project(code: str, session: SessionDep) -> ProjectRead:
    """Get one project by its code."""
    return ProjectRead.model_validate(await get_project_or_404(session, code))
