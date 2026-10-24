"""Subject endpoints. Subjects belong to a study and are addressed through it."""

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from protolims_api.audit import record_event
from protolims_api.db import SessionDep
from protolims_api.models import Subject
from protolims_api.routers.studies import get_study_or_404
from protolims_api.schemas.subject import SubjectCreate, SubjectRead

router = APIRouter(tags=["subjects"])


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
    return SubjectRead.model_validate(subject)


@router.get("/projects/{project_code}/studies/{study_code}/subjects")
async def list_subjects(
    project_code: str,
    study_code: str,
    session: SessionDep,
    limit: Annotated[int, Query(ge=1, le=500)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[SubjectRead]:
    """List a study's subjects, ordered by name."""
    study = await get_study_or_404(session, project_code, study_code)
    result = await session.scalars(
        select(Subject)
        .where(Subject.study_id == study.id)
        .order_by(Subject.name)
        .limit(limit)
        .offset(offset)
    )
    return [SubjectRead.model_validate(subject) for subject in result]


@router.get("/projects/{project_code}/studies/{study_code}/subjects/{name}")
async def get_subject(
    project_code: str, study_code: str, name: str, session: SessionDep
) -> SubjectRead:
    """Get one subject by its name within a study."""
    study = await get_study_or_404(session, project_code, study_code)
    subject = await session.scalar(
        select(Subject).where(Subject.study_id == study.id, Subject.name == name)
    )
    if subject is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Subject {name!r} not found in study {study_code!r}",
        )
    return SubjectRead.model_validate(subject)
