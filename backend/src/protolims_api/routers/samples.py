"""Sample endpoints.

Samples are created and listed under their study, and fetched by their permanent ID.
A sample's subject and parent sample must be in the same study: connections between
studies are made only by explicit links.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from protolims_api.audit import record_event
from protolims_api.db import SessionDep
from protolims_api.models import Project, Sample, Study, Subject
from protolims_api.routers.studies import get_study_or_404
from protolims_api.schemas.sample import SampleCreate, SampleFields, SampleRead

router = APIRouter(tags=["samples"])

Parent = aliased(Sample)

# Samples with their project and study codes, and their subject's and parent's names.
SAMPLE_QUERY = (
    select(Sample, Project.code, Study.code, Subject.name, Parent.name)
    .join(Study, Sample.study_id == Study.id)
    .join(Project, Study.project_id == Project.id)
    .outerjoin(Subject, Sample.subject_id == Subject.id)
    .outerjoin(Parent, Sample.parent_sample_id == Parent.id)
)


def sample_read(
    sample: Sample,
    project_code: str,
    study_code: str,
    subject_name: str | None,
    parent_sample_name: str | None,
) -> SampleRead:
    return SampleRead(
        **SampleFields.model_validate(sample).model_dump(),
        project_code=project_code,
        study_code=study_code,
        subject_name=subject_name,
        parent_sample_name=parent_sample_name,
    )


async def linked_names(
    session: AsyncSession, payload: SampleCreate, study: Study
) -> tuple[str | None, str | None]:
    """Check the subject and parent sample (if given) are in this study; return their names."""
    subject_name = None
    if payload.subject_id is not None:
        subject = await session.get(Subject, payload.subject_id)
        if subject is None or subject.study_id != study.id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="The subject must be an existing subject in the same study",
            )
        subject_name = subject.name
    parent_name = None
    if payload.parent_sample_id is not None:
        parent = await session.get(Sample, payload.parent_sample_id)
        if parent is None or parent.study_id != study.id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="The parent sample must be an existing sample in the same study",
            )
        parent_name = parent.name
    return subject_name, parent_name


@router.post(
    "/projects/{project_code}/studies/{study_code}/samples",
    status_code=status.HTTP_201_CREATED,
)
async def create_sample(
    project_code: str, study_code: str, payload: SampleCreate, session: SessionDep
) -> SampleRead:
    """Create a sample within a study. Sample names are unique within their study."""
    study = await get_study_or_404(session, project_code, study_code)
    subject_name, parent_name = await linked_names(session, payload, study)
    sample = Sample(study_id=study.id, **payload.model_dump())
    session.add(sample)
    try:
        await session.flush()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Sample {payload.name!r} already exists in study {study_code!r}",
        ) from exc
    await record_event(
        session,
        action="create",
        entity_type="sample",
        entity_id=sample.id,
        changes={
            "after": {
                "project": project_code,
                "study": study_code,
                **payload.model_dump(mode="json"),
            }
        },
    )
    await session.commit()
    await session.refresh(sample)
    return sample_read(sample, project_code, study_code, subject_name, parent_name)


@router.get("/projects/{project_code}/studies/{study_code}/samples")
async def list_samples(
    project_code: str,
    study_code: str,
    session: SessionDep,
    limit: Annotated[int, Query(ge=1, le=500)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[SampleRead]:
    """List a study's samples, ordered by name."""
    study = await get_study_or_404(session, project_code, study_code)
    result = await session.execute(
        SAMPLE_QUERY.where(Sample.study_id == study.id)
        .order_by(Sample.name)
        .limit(limit)
        .offset(offset)
    )
    return [
        sample_read(sample, row_project_code, row_study_code, subject_name, parent_name)
        for sample, row_project_code, row_study_code, subject_name, parent_name in result
    ]


@router.get("/samples/{sample_id}")
async def get_sample(sample_id: uuid.UUID, session: SessionDep) -> SampleRead:
    """Get one sample by its permanent ID."""
    row = (await session.execute(SAMPLE_QUERY.where(Sample.id == sample_id))).one_or_none()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sample {sample_id} not found",
        )
    sample, project_code, study_code, subject_name, parent_name = row
    return sample_read(sample, project_code, study_code, subject_name, parent_name)
