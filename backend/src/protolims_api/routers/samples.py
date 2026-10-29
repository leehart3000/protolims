"""Sample endpoints.

Samples are created and listed under their study, and fetched by their permanent ID.
A sample's subject and parent sample must be in the same study: connections between
studies are made only by explicit links.
"""

import uuid
from datetime import UTC, datetime
from typing import Annotated, Any, Literal

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import ColumnElement, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute, aliased

from protolims_api.audit import record_event
from protolims_api.conflicts import external_id_conflict, is_external_id_conflict
from protolims_api.db import SessionDep
from protolims_api.models import Project, Sample, Study, Subject
from protolims_api.permissions import ActorDep, require_editor_of, require_study_role
from protolims_api.routers.studies import get_study_or_404
from protolims_api.schemas.common import Page
from protolims_api.schemas.sample import SampleCreate, SampleFields, SampleRead, SampleUpdate

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

SampleSort = Literal[
    "name",
    "-name",
    "material_type",
    "-material_type",
    "subject",
    "-subject",
    "status",
    "-status",
    "created_at",
    "-created_at",
]

# What each sort key orders by. A leading "-" reverses the order.
SAMPLE_SORT_COLUMNS: dict[str, InstrumentedAttribute[Any]] = {
    "name": Sample.name,
    "material_type": Sample.material_type,
    "subject": Subject.name,
    "status": Sample.status,
    "created_at": Sample.created_at,
}


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
    session: AsyncSession,
    study_id: uuid.UUID,
    subject_id: uuid.UUID | None,
    parent_sample_id: uuid.UUID | None,
) -> tuple[str | None, str | None]:
    """Check the subject and parent sample (if given) are in this study; return their names."""
    subject_name = None
    if subject_id is not None:
        subject = await session.get(Subject, subject_id)
        if subject is None or subject.study_id != study_id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="The subject must be an existing subject in the same study",
            )
        subject_name = subject.name
    parent_name = None
    if parent_sample_id is not None:
        parent = await session.get(Sample, parent_sample_id)
        if parent is None or parent.study_id != study_id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="The parent sample must be an existing sample in the same study",
            )
        parent_name = parent.name
    return subject_name, parent_name


async def makes_a_loop(
    session: AsyncSession, sample_id: uuid.UUID, new_parent_id: uuid.UUID
) -> bool:
    """Whether deriving a sample from new_parent_id would make it its own ancestor."""
    current: uuid.UUID | None = new_parent_id
    while current is not None:
        if current == sample_id:
            return True
        current = await session.scalar(select(Sample.parent_sample_id).where(Sample.id == current))
    return False


@router.post(
    "/projects/{project_code}/studies/{study_code}/samples",
    status_code=status.HTTP_201_CREATED,
)
async def create_sample(
    project_code: str,
    study_code: str,
    payload: SampleCreate,
    session: SessionDep,
    actor: ActorDep,
) -> SampleRead:
    """Create a sample within a study. Sample names are unique within their study."""
    study = await get_study_or_404(session, project_code, study_code)
    await require_study_role(session, actor, study, "editor")
    subject_name, parent_name = await linked_names(
        session, study.id, payload.subject_id, payload.parent_sample_id
    )
    sample = Sample(study_id=study.id, created_by=actor.label, **payload.model_dump())
    session.add(sample)
    try:
        await session.flush()
    except IntegrityError as exc:
        await session.rollback()
        if is_external_id_conflict(exc):
            raise external_id_conflict(
                "sample", payload.external_id, f"in study {study_code!r}"
            ) from exc
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Sample {payload.name!r} already exists in study {study_code!r}",
        ) from exc
    await record_event(
        session,
        action="create",
        entity_type="sample",
        entity_id=sample.id,
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
    await session.refresh(sample)
    return sample_read(sample, project_code, study_code, subject_name, parent_name)


@router.get("/projects/{project_code}/studies/{study_code}/samples")
async def list_samples(
    project_code: str,
    study_code: str,
    session: SessionDep,
    subject: Annotated[
        uuid.UUID | None, Query(description="Only list samples from this subject")
    ] = None,
    parent: Annotated[
        uuid.UUID | None, Query(description="Only list samples derived from this sample")
    ] = None,
    q: Annotated[
        str | None,
        Query(max_length=200, description="Search sample names and external IDs, ignoring case"),
    ] = None,
    sort: Annotated[
        SampleSort, Query(description="The column to sort by; a leading - reverses the order")
    ] = "name",
    limit: Annotated[int, Query(ge=1, le=500)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> Page[SampleRead]:
    """List a study's samples a page at a time, with the total number that match."""
    study = await get_study_or_404(session, project_code, study_code)
    conditions: list[ColumnElement[bool]] = [Sample.study_id == study.id]
    if subject is not None:
        conditions.append(Sample.subject_id == subject)
    if parent is not None:
        conditions.append(Sample.parent_sample_id == parent)
    if q:
        conditions.append(
            or_(
                Sample.name.icontains(q, autoescape=True),
                Sample.external_id.icontains(q, autoescape=True),
            )
        )
    count_query = select(func.count()).select_from(Sample).where(*conditions)
    total = (await session.execute(count_query)).scalar_one()

    column = SAMPLE_SORT_COLUMNS[sort.removeprefix("-")]
    order = column.desc() if sort.startswith("-") else column.asc()
    result = await session.execute(
        SAMPLE_QUERY.where(*conditions)
        .order_by(order.nulls_last(), Sample.name, Sample.id)
        .limit(limit)
        .offset(offset)
    )
    return Page[SampleRead](
        items=[
            sample_read(sample, row_project_code, row_study_code, subject_name, parent_name)
            for sample, row_project_code, row_study_code, subject_name, parent_name in result
        ],
        total=total,
    )


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


@router.patch("/samples/{sample_id}")
async def update_sample(
    sample_id: uuid.UUID, payload: SampleUpdate, session: SessionDep, actor: ActorDep
) -> SampleRead:
    """Change some of a sample's details. Only the fields sent are changed; null clears one."""
    sample = await session.get(Sample, sample_id)
    if sample is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sample {sample_id} not found",
        )
    await require_editor_of(session, actor, sample.study_id)

    requested = payload.model_dump(exclude_unset=True)
    changed = {
        field: value for field, value in requested.items() if getattr(sample, field) != value
    }
    if changed:
        await linked_names(
            session, sample.study_id, changed.get("subject_id"), changed.get("parent_sample_id")
        )
        new_parent = changed.get("parent_sample_id")
        if new_parent is not None and await makes_a_loop(session, sample.id, new_parent):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="A sample can't be derived from itself or from a sample derived from it",
            )

        before = SampleFields.model_validate(sample).model_dump(mode="json")
        for field, value in changed.items():
            setattr(sample, field, value)
        sample.updated_at = datetime.now(UTC)
        try:
            await session.flush()
        except IntegrityError as exc:
            await session.rollback()
            if is_external_id_conflict(exc):
                raise external_id_conflict("sample", payload.external_id, "in this study") from exc
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Sample {payload.name!r} already exists in this study",
            ) from exc
        await record_event(
            session,
            action="update",
            entity_type="sample",
            entity_id=sample.id,
            actor=actor.label,
            changes={
                "before": {field: before[field] for field in changed},
                "after": payload.model_dump(mode="json", include=set(changed)),
            },
        )
        await session.commit()

    row = (await session.execute(SAMPLE_QUERY.where(Sample.id == sample_id))).one()
    updated, project_code, study_code, subject_name, parent_name = row
    return sample_read(updated, project_code, study_code, subject_name, parent_name)
