"""Subject endpoints.

Subjects are created and listed under their study, and fetched by their permanent ID,
so links to a subject keep working even if its name is corrected.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from protolims_api.audit import record_event
from protolims_api.db import SessionDep
from protolims_api.models import Project, Study, Subject
from protolims_api.routers.studies import get_study_or_404
from protolims_api.schemas.subject import SubjectCreate, SubjectFields, SubjectRead

router = APIRouter(tags=["subjects"])


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
    return [subject_read(subject, project_code, study_code) for subject in result]


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
