"""Assay endpoints.

Assays are created and listed under their study, and fetched by their permanent ID.
"""

import uuid
from datetime import UTC, datetime
from typing import Annotated, Any, Literal

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import ColumnElement, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import InstrumentedAttribute

from protolims_api.audit import record_event
from protolims_api.db import SessionDep
from protolims_api.models import Assay, Project, Study
from protolims_api.routers.studies import get_study_or_404
from protolims_api.schemas.assay import AssayCreate, AssayFields, AssayRead, AssayUpdate
from protolims_api.schemas.common import Page

router = APIRouter(tags=["assays"])

# Assays with their project and study codes.
ASSAY_QUERY = (
    select(Assay, Project.code, Study.code)
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


def assay_read(assay: Assay, project_code: str, study_code: str) -> AssayRead:
    return AssayRead(
        **AssayFields.model_validate(assay).model_dump(),
        project_code=project_code,
        study_code=study_code,
    )


@router.post(
    "/projects/{project_code}/studies/{study_code}/assays",
    status_code=status.HTTP_201_CREATED,
)
async def create_assay(
    project_code: str, study_code: str, payload: AssayCreate, session: SessionDep
) -> AssayRead:
    """Create an assay within a study. Assay names are unique within their study."""
    study = await get_study_or_404(session, project_code, study_code)
    assay = Assay(study_id=study.id, **payload.model_dump())
    session.add(assay)
    try:
        await session.flush()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Assay {payload.name!r} already exists in study {study_code!r}",
        ) from exc
    await record_event(
        session,
        action="create",
        entity_type="assay",
        entity_id=assay.id,
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
    return assay_read(assay, project_code, study_code)


@router.get("/projects/{project_code}/studies/{study_code}/assays")
async def list_assays(
    project_code: str,
    study_code: str,
    session: SessionDep,
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
    study = await get_study_or_404(session, project_code, study_code)
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
            assay_read(assay, row_project_code, row_study_code)
            for assay, row_project_code, row_study_code in result
        ],
        total=total,
    )


@router.get("/assays/{assay_id}")
async def get_assay(assay_id: uuid.UUID, session: SessionDep) -> AssayRead:
    """Get one assay by its permanent ID."""
    row = (await session.execute(ASSAY_QUERY.where(Assay.id == assay_id))).one_or_none()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Assay {assay_id} not found",
        )
    assay, project_code, study_code = row
    return assay_read(assay, project_code, study_code)


@router.patch("/assays/{assay_id}")
async def update_assay(assay_id: uuid.UUID, payload: AssayUpdate, session: SessionDep) -> AssayRead:
    """Change some of an assay's details. Only the fields sent are changed; null clears one."""
    assay = await session.get(Assay, assay_id)
    if assay is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Assay {assay_id} not found",
        )

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
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Assay {payload.name!r} already exists in this study",
            ) from exc
        await record_event(
            session,
            action="update",
            entity_type="assay",
            entity_id=assay.id,
            changes={
                "before": {field: before[field] for field in changed},
                "after": payload.model_dump(mode="json", include=set(changed)),
            },
        )
        await session.commit()

    row = (await session.execute(ASSAY_QUERY.where(Assay.id == assay_id))).one()
    updated, project_code, study_code = row
    return assay_read(updated, project_code, study_code)
