"""Data file endpoints.

Data files are recorded and listed under their study, and fetched by their permanent ID.
A file's assay, if it has one, must be in the same study. The API only stores where a file
is; it never fetches it.
"""

import uuid
from datetime import UTC, datetime
from typing import Annotated, Any, Literal

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import ColumnElement, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute

from protolims_api.audit import record_event
from protolims_api.db import SessionDep
from protolims_api.models import Assay, DataFile, DataFileSample, Project, Study
from protolims_api.routers.studies import get_study_or_404
from protolims_api.schemas.common import Page
from protolims_api.schemas.data_file import (
    DataFileCreate,
    DataFileFields,
    DataFileLevel,
    DataFileRead,
    DataFileUpdate,
)

router = APIRouter(tags=["data files"])

# How many samples each file holds.
SAMPLE_COUNT = (
    select(func.count())
    .select_from(DataFileSample)
    .where(DataFileSample.data_file_id == DataFile.id)
    .correlate(DataFile)
    .scalar_subquery()
)

# Data files with their project and study codes, assay name and sample count.
DATA_FILE_QUERY = (
    select(DataFile, Project.code, Study.code, Assay.name, SAMPLE_COUNT)
    .join(Study, DataFile.study_id == Study.id)
    .join(Project, Study.project_id == Project.id)
    .outerjoin(Assay, DataFile.assay_id == Assay.id)
)

DataFileSort = Literal[
    "name",
    "-name",
    "level",
    "-level",
    "format",
    "-format",
    "size_bytes",
    "-size_bytes",
    "created_at",
    "-created_at",
]

# What each sort key orders by. A leading "-" reverses the order.
DATA_FILE_SORT_COLUMNS: dict[str, InstrumentedAttribute[Any]] = {
    "name": DataFile.name,
    "level": DataFile.level,
    "format": DataFile.format,
    "size_bytes": DataFile.size_bytes,
    "created_at": DataFile.created_at,
}


def data_file_read(
    data_file: DataFile,
    project_code: str,
    study_code: str,
    assay_name: str | None,
    sample_count: int,
) -> DataFileRead:
    return DataFileRead(
        **DataFileFields.model_validate(data_file).model_dump(),
        project_code=project_code,
        study_code=study_code,
        assay_name=assay_name,
        sample_count=sample_count,
    )


async def assay_name_in_study(
    session: AsyncSession, study_id: uuid.UUID, assay_id: uuid.UUID | None
) -> str | None:
    """Check the assay (if given) is in this study; return its name."""
    if assay_id is None:
        return None
    assay = await session.get(Assay, assay_id)
    if assay is None or assay.study_id != study_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="The assay must be an existing assay in the same study",
        )
    return assay.name


async def read_data_file(session: AsyncSession, data_file_id: uuid.UUID) -> DataFileRead | None:
    row = (await session.execute(DATA_FILE_QUERY.where(DataFile.id == data_file_id))).one_or_none()
    if row is None:
        return None
    data_file, project_code, study_code, assay_name, sample_count = row
    return data_file_read(data_file, project_code, study_code, assay_name, sample_count)


def not_found(data_file_id: uuid.UUID) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Data file {data_file_id} not found",
    )


@router.post(
    "/projects/{project_code}/studies/{study_code}/data-files",
    status_code=status.HTTP_201_CREATED,
)
async def create_data_file(
    project_code: str, study_code: str, payload: DataFileCreate, session: SessionDep
) -> DataFileRead:
    """Record a data file in a study. A URI can be recorded only once in each study."""
    study = await get_study_or_404(session, project_code, study_code)
    assay_name = await assay_name_in_study(session, study.id, payload.assay_id)
    data_file = DataFile(study_id=study.id, **payload.model_dump())
    session.add(data_file)
    try:
        await session.flush()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A file with this URI is already recorded in study {study_code!r}",
        ) from exc
    await record_event(
        session,
        action="create",
        entity_type="data_file",
        entity_id=data_file.id,
        changes={
            "after": {
                "project": project_code,
                "study": study_code,
                **payload.model_dump(mode="json"),
            }
        },
    )
    await session.commit()
    await session.refresh(data_file)
    return data_file_read(data_file, project_code, study_code, assay_name, 0)


@router.get("/projects/{project_code}/studies/{study_code}/data-files")
async def list_data_files(
    project_code: str,
    study_code: str,
    session: SessionDep,
    assay: Annotated[uuid.UUID | None, Query(description="Only list files from this assay")] = None,
    level: Annotated[DataFileLevel | None, Query(description="Only list files at this level")] = (
        None
    ),
    q: Annotated[
        str | None,
        Query(
            max_length=200,
            description="Search file names, external IDs and URIs, ignoring case",
        ),
    ] = None,
    sort: Annotated[
        DataFileSort, Query(description="The column to sort by; a leading - reverses the order")
    ] = "name",
    limit: Annotated[int, Query(ge=1, le=500)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> Page[DataFileRead]:
    """List a study's data files a page at a time, with the total number that match."""
    study = await get_study_or_404(session, project_code, study_code)
    conditions: list[ColumnElement[bool]] = [DataFile.study_id == study.id]
    if assay is not None:
        conditions.append(DataFile.assay_id == assay)
    if level is not None:
        conditions.append(DataFile.level == level)
    if q:
        conditions.append(
            or_(
                DataFile.name.icontains(q, autoescape=True),
                DataFile.external_id.icontains(q, autoescape=True),
                DataFile.uri.icontains(q, autoescape=True),
            )
        )
    count_query = select(func.count()).select_from(DataFile).where(*conditions)
    total = (await session.execute(count_query)).scalar_one()

    column = DATA_FILE_SORT_COLUMNS[sort.removeprefix("-")]
    order = column.desc() if sort.startswith("-") else column.asc()
    result = await session.execute(
        DATA_FILE_QUERY.where(*conditions)
        .order_by(order.nulls_last(), DataFile.name, DataFile.id)
        .limit(limit)
        .offset(offset)
    )
    return Page[DataFileRead](
        items=[
            data_file_read(data_file, row_project, row_study, assay_name, sample_count)
            for data_file, row_project, row_study, assay_name, sample_count in result
        ],
        total=total,
    )


@router.get("/data-files/{data_file_id}")
async def get_data_file(data_file_id: uuid.UUID, session: SessionDep) -> DataFileRead:
    """Get one data file by its permanent ID."""
    found = await read_data_file(session, data_file_id)
    if found is None:
        raise not_found(data_file_id)
    return found


@router.patch("/data-files/{data_file_id}")
async def update_data_file(
    data_file_id: uuid.UUID, payload: DataFileUpdate, session: SessionDep
) -> DataFileRead:
    """Change some of a data file's details. Only the fields sent are changed; null clears one."""
    data_file = await session.get(DataFile, data_file_id)
    if data_file is None:
        raise not_found(data_file_id)

    requested = payload.model_dump(exclude_unset=True)
    changed = {
        field: value for field, value in requested.items() if getattr(data_file, field) != value
    }
    if changed:
        await assay_name_in_study(session, data_file.study_id, changed.get("assay_id"))
        before = DataFileFields.model_validate(data_file).model_dump(mode="json")
        for field, value in changed.items():
            setattr(data_file, field, value)
        data_file.updated_at = datetime.now(UTC)
        try:
            await session.flush()
        except IntegrityError as exc:
            await session.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A file with this URI is already recorded in this study",
            ) from exc
        await record_event(
            session,
            action="update",
            entity_type="data_file",
            entity_id=data_file.id,
            changes={
                "before": {field: before[field] for field in changed},
                "after": payload.model_dump(mode="json", include=set(changed)),
            },
        )
        await session.commit()

    updated = await read_data_file(session, data_file_id)
    assert updated is not None  # It was found above, and records are never deleted.
    return updated
