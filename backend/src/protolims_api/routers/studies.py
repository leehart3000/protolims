"""Study endpoints."""

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from protolims_api.audit import record_event
from protolims_api.db import SessionDep
from protolims_api.models import Study
from protolims_api.routers.projects import get_project_or_404
from protolims_api.schemas.study import StudyCreate, StudyRead

router = APIRouter(tags=["studies"])


@router.post("/projects/{project_code}/studies", status_code=status.HTTP_201_CREATED)
async def create_study(project_code: str, payload: StudyCreate, session: SessionDep) -> StudyRead:
    """Create a study within a project."""
    project = await get_project_or_404(session, project_code)
    study = Study(project_id=project.id, **payload.model_dump())
    session.add(study)
    try:
        await session.flush()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Study code {payload.code!r} already exists",
        ) from exc
    await record_event(
        session,
        action="create",
        entity_type="study",
        entity_id=study.id,
        changes={"after": {"project": project_code, **payload.model_dump(mode="json")}},
    )
    await session.commit()
    await session.refresh(study)
    return StudyRead.model_validate(study)


@router.get("/projects/{project_code}/studies")
async def list_studies(
    project_code: str,
    session: SessionDep,
    limit: Annotated[int, Query(ge=1, le=500)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[StudyRead]:
    """List a project's studies, ordered by code."""
    project = await get_project_or_404(session, project_code)
    result = await session.scalars(
        select(Study)
        .where(Study.project_id == project.id)
        .order_by(Study.code)
        .limit(limit)
        .offset(offset)
    )
    return [StudyRead.model_validate(study) for study in result]


@router.get("/studies/{code}")
async def get_study(code: str, session: SessionDep) -> StudyRead:
    """Get one study by its code."""
    study = await session.scalar(select(Study).where(Study.code == code))
    if study is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Study {code!r} not found",
        )
    return StudyRead.model_validate(study)
