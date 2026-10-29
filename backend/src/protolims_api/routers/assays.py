"""Assay endpoints.

Assays are created and listed under their study, and fetched by their permanent ID.
An assay's samples must be in the same study: connections between studies are made only
by explicit links.
"""

import uuid
from datetime import UTC, datetime
from typing import Annotated, Any, Literal

from fastapi import APIRouter, HTTPException, Query, Response, status
from sqlalchemy import ColumnElement, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute

from protolims_api.audit import record_event
from protolims_api.conflicts import external_id_conflict, is_external_id_conflict
from protolims_api.db import SessionDep
from protolims_api.models import Assay, AssaySample, Project, Sample, Study
from protolims_api.permissions import (
    Actor,
    ActorDep,
    can_see_study,
    require_editor_of,
    require_study_role,
    visible_studies,
)
from protolims_api.routers.studies import get_study_or_404
from protolims_api.schemas.assay import (
    AssayCreate,
    AssayFields,
    AssayRead,
    AssaySampleLink,
    AssaySampleRead,
    AssayUpdate,
    SampleAssayRead,
)
from protolims_api.schemas.common import Page

router = APIRouter(tags=["assays"])

# How many samples each assay measured.
SAMPLE_COUNT = (
    select(func.count())
    .select_from(AssaySample)
    .where(AssaySample.assay_id == Assay.id)
    .correlate(Assay)
    .scalar_subquery()
)

# Assays with their project and study codes, and how many samples they measured.
ASSAY_QUERY = (
    select(Assay, Project.code, Study.code, SAMPLE_COUNT)
    .join(Study, Assay.study_id == Study.id)
    .join(Project, Study.project_id == Project.id)
)

AssaySort = Literal[
    "name",
    "-name",
    "measurement_type",
    "-measurement_type",
    "technology_type",
    "-technology_type",
    "platform",
    "-platform",
    "performed_at",
    "-performed_at",
    "created_at",
    "-created_at",
]

# What each sort key orders by. A leading "-" reverses the order.
ASSAY_SORT_COLUMNS: dict[str, InstrumentedAttribute[Any]] = {
    "name": Assay.name,
    "measurement_type": Assay.measurement_type,
    "technology_type": Assay.technology_type,
    "platform": Assay.platform,
    "performed_at": Assay.performed_at,
    "created_at": Assay.created_at,
}

AssaySampleSort = Literal["name", "-name", "label", "-label"]

ASSAY_SAMPLE_SORT_COLUMNS: dict[str, InstrumentedAttribute[Any]] = {
    "name": Sample.name,
    "label": AssaySample.label,
}


def assay_read(assay: Assay, project_code: str, study_code: str, sample_count: int) -> AssayRead:
    return AssayRead(
        **AssayFields.model_validate(assay).model_dump(),
        project_code=project_code,
        study_code=study_code,
        sample_count=sample_count,
    )


def assay_sample_read(sample: Sample, label: str | None) -> AssaySampleRead:
    return AssaySampleRead(
        sample_id=sample.id,
        sample_name=sample.name,
        external_id=sample.external_id,
        material_type=sample.material_type,
        status=sample.status,
        label=label,
    )


async def get_assay_or_404(session: AsyncSession, assay_id: uuid.UUID, actor: Actor) -> Assay:
    """Find an assay, or respond with 404. One in a study the actor can't see is not found."""
    assay = await session.get(Assay, assay_id)
    if assay is None or not await can_see_study(session, actor, assay.study_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Assay {assay_id} not found",
        )
    return assay


@router.post(
    "/projects/{project_code}/studies/{study_code}/assays",
    status_code=status.HTTP_201_CREATED,
)
async def create_assay(
    project_code: str,
    study_code: str,
    payload: AssayCreate,
    session: SessionDep,
    actor: ActorDep,
) -> AssayRead:
    """Create an assay within a study. Assay names are unique within their study."""
    study = await get_study_or_404(session, project_code, study_code, actor)
    await require_study_role(session, actor, study, "editor")
    assay = Assay(study_id=study.id, created_by=actor.label, **payload.model_dump())
    session.add(assay)
    try:
        await session.flush()
    except IntegrityError as exc:
        await session.rollback()
        if is_external_id_conflict(exc):
            raise external_id_conflict(
                "assay", payload.external_id, f"in study {study_code!r}"
            ) from exc
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Assay {payload.name!r} already exists in study {study_code!r}",
        ) from exc
    await record_event(
        session,
        action="create",
        entity_type="assay",
        entity_id=assay.id,
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
    await session.refresh(assay)
    return assay_read(assay, project_code, study_code, 0)


@router.get("/projects/{project_code}/studies/{study_code}/assays")
async def list_assays(
    project_code: str,
    study_code: str,
    session: SessionDep,
    actor: ActorDep,
    q: Annotated[
        str | None,
        Query(max_length=200, description="Search assay names and external IDs, ignoring case"),
    ] = None,
    sort: Annotated[
        AssaySort, Query(description="The column to sort by; a leading - reverses the order")
    ] = "name",
    limit: Annotated[int, Query(ge=1, le=500)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> Page[AssayRead]:
    """List a study's assays a page at a time, with the total number that match."""
    study = await get_study_or_404(session, project_code, study_code, actor)
    conditions: list[ColumnElement[bool]] = [Assay.study_id == study.id]
    if q:
        conditions.append(
            or_(
                Assay.name.icontains(q, autoescape=True),
                Assay.external_id.icontains(q, autoescape=True),
            )
        )
    count_query = select(func.count()).select_from(Assay).where(*conditions)
    total = (await session.execute(count_query)).scalar_one()

    column = ASSAY_SORT_COLUMNS[sort.removeprefix("-")]
    order = column.desc() if sort.startswith("-") else column.asc()
    result = await session.execute(
        ASSAY_QUERY.where(*conditions)
        .order_by(order.nulls_last(), Assay.name, Assay.id)
        .limit(limit)
        .offset(offset)
    )
    return Page[AssayRead](
        items=[
            assay_read(assay, row_project_code, row_study_code, sample_count)
            for assay, row_project_code, row_study_code, sample_count in result
        ],
        total=total,
    )


@router.get("/assays/{assay_id}")
async def get_assay(assay_id: uuid.UUID, session: SessionDep, actor: ActorDep) -> AssayRead:
    """Get one assay by its permanent ID."""
    query = ASSAY_QUERY.where(Assay.id == assay_id, visible_studies(actor))
    row = (await session.execute(query)).one_or_none()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Assay {assay_id} not found",
        )
    assay, project_code, study_code, sample_count = row
    return assay_read(assay, project_code, study_code, sample_count)


@router.patch("/assays/{assay_id}")
async def update_assay(
    assay_id: uuid.UUID, payload: AssayUpdate, session: SessionDep, actor: ActorDep
) -> AssayRead:
    """Change some of an assay's details. Only the fields sent are changed; null clears one."""
    assay = await get_assay_or_404(session, assay_id, actor)
    await require_editor_of(session, actor, assay.study_id)

    requested = payload.model_dump(exclude_unset=True)
    changed = {field: value for field, value in requested.items() if getattr(assay, field) != value}
    if changed:
        before = AssayFields.model_validate(assay).model_dump(mode="json")
        for field, value in changed.items():
            setattr(assay, field, value)
        assay.updated_at = datetime.now(UTC)
        try:
            await session.flush()
        except IntegrityError as exc:
            await session.rollback()
            if is_external_id_conflict(exc):
                raise external_id_conflict("assay", payload.external_id, "in this study") from exc
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Assay {payload.name!r} already exists in this study",
            ) from exc
        await record_event(
            session,
            action="update",
            entity_type="assay",
            entity_id=assay.id,
            actor=actor.label,
            changes={
                "before": {field: before[field] for field in changed},
                "after": payload.model_dump(mode="json", include=set(changed)),
            },
        )
        await session.commit()

    row = (await session.execute(ASSAY_QUERY.where(Assay.id == assay_id))).one()
    updated, project_code, study_code, sample_count = row
    return assay_read(updated, project_code, study_code, sample_count)


@router.get("/assays/{assay_id}/samples")
async def list_assay_samples(
    assay_id: uuid.UUID,
    session: SessionDep,
    actor: ActorDep,
    q: Annotated[
        str | None,
        Query(max_length=200, description="Search sample names and external IDs, ignoring case"),
    ] = None,
    sort: Annotated[
        AssaySampleSort,
        Query(description="The column to sort by; a leading - reverses the order"),
    ] = "name",
    limit: Annotated[int, Query(ge=1, le=500)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> Page[AssaySampleRead]:
    """List the samples an assay measured, a page at a time, with the total number that match."""
    await get_assay_or_404(session, assay_id, actor)
    conditions: list[ColumnElement[bool]] = [AssaySample.assay_id == assay_id]
    if q:
        conditions.append(
            or_(
                Sample.name.icontains(q, autoescape=True),
                Sample.external_id.icontains(q, autoescape=True),
            )
        )
    count_query = (
        select(func.count())
        .select_from(AssaySample)
        .join(Sample, AssaySample.sample_id == Sample.id)
        .where(*conditions)
    )
    total = (await session.execute(count_query)).scalar_one()

    column = ASSAY_SAMPLE_SORT_COLUMNS[sort.removeprefix("-")]
    order = column.desc() if sort.startswith("-") else column.asc()
    result = await session.execute(
        select(Sample, AssaySample.label)
        .join(AssaySample, AssaySample.sample_id == Sample.id)
        .where(*conditions)
        .order_by(order.nulls_last(), Sample.name, Sample.id)
        .limit(limit)
        .offset(offset)
    )
    return Page[AssaySampleRead](
        items=[assay_sample_read(sample, label) for sample, label in result],
        total=total,
    )


@router.put("/assays/{assay_id}/samples/{sample_id}")
async def link_sample(
    assay_id: uuid.UUID,
    sample_id: uuid.UUID,
    payload: AssaySampleLink,
    session: SessionDep,
    actor: ActorDep,
    response: Response,
) -> AssaySampleRead:
    """Record that an assay measured a sample, or change the sample's label in it.

    Returns 201 when the link is new and 200 when it already existed, so it's safe to repeat.
    """
    assay = await get_assay_or_404(session, assay_id, actor)
    await require_editor_of(session, actor, assay.study_id)
    sample = await session.get(Sample, sample_id)
    if sample is None or sample.study_id != assay.study_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="The sample must be an existing sample in the same study",
        )
    which = {"sample_id": str(sample.id), "sample": sample.name}

    link = await session.get(AssaySample, (assay_id, sample_id))
    if link is None:
        link = AssaySample(
            assay_id=assay_id, sample_id=sample_id, label=payload.label, created_by=actor.label
        )
        session.add(link)
        await record_event(
            session,
            action="add_sample",
            entity_type="assay",
            entity_id=assay_id,
            actor=actor.label,
            changes={"after": {**which, "label": payload.label}},
        )
        response.status_code = status.HTTP_201_CREATED
    elif link.label != payload.label:
        await record_event(
            session,
            action="update_sample",
            entity_type="assay",
            entity_id=assay_id,
            actor=actor.label,
            changes={
                "before": {**which, "label": link.label},
                "after": {**which, "label": payload.label},
            },
        )
        link.label = payload.label
        link.updated_at = datetime.now(UTC)

    result = assay_sample_read(sample, payload.label)
    await session.commit()
    return result


@router.delete("/assays/{assay_id}/samples/{sample_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unlink_sample(
    assay_id: uuid.UUID, sample_id: uuid.UUID, session: SessionDep, actor: ActorDep
) -> None:
    """Remove a sample from an assay."""
    assay = await get_assay_or_404(session, assay_id, actor)
    await require_editor_of(session, actor, assay.study_id)
    link = await session.get(AssaySample, (assay_id, sample_id))
    if link is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sample {sample_id} is not linked to assay {assay_id}",
        )
    sample_name = await session.scalar(select(Sample.name).where(Sample.id == sample_id))
    await record_event(
        session,
        action="remove_sample",
        entity_type="assay",
        entity_id=assay_id,
        actor=actor.label,
        changes={
            "before": {"sample_id": str(sample_id), "sample": sample_name, "label": link.label}
        },
    )
    await session.delete(link)
    await session.commit()


@router.get("/samples/{sample_id}/assays")
async def list_sample_assays(
    sample_id: uuid.UUID, session: SessionDep, actor: ActorDep
) -> list[SampleAssayRead]:
    """List the assays a sample was measured in, by name."""
    sample = await session.get(Sample, sample_id)
    if sample is None or not await can_see_study(session, actor, sample.study_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sample {sample_id} not found",
        )
    result = await session.execute(
        select(Assay, AssaySample.label)
        .join(AssaySample, AssaySample.assay_id == Assay.id)
        .where(AssaySample.sample_id == sample_id)
        .order_by(Assay.name, Assay.id)
    )
    return [
        SampleAssayRead(
            assay_id=assay.id,
            assay_name=assay.name,
            measurement_type=assay.measurement_type,
            technology_type=assay.technology_type,
            platform=assay.platform,
            label=label,
        )
        for assay, label in result
    ]
