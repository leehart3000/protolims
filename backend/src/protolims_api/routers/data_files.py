"""Data file endpoints.

Data files are recorded and listed under their study, and fetched by their permanent ID.
A file's assay, if it has one, must be in the same study, as must its samples and inputs.
A file can't be derived from itself or from a file derived from it. The API only stores
where a file is; it never fetches it.
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
from protolims_api.models import (
    Assay,
    DataFile,
    DataFileInput,
    DataFileSample,
    Project,
    Sample,
    Study,
)
from protolims_api.permissions import (
    Actor,
    ActorDep,
    can_see_study,
    require_editor_of,
    require_study_role,
    visible_studies,
)
from protolims_api.routers.studies import get_study_or_404
from protolims_api.schemas.common import Page
from protolims_api.schemas.data_file import (
    DataFileCreate,
    DataFileFields,
    DataFileLevel,
    DataFileRead,
    DataFileSampleLink,
    DataFileSampleRead,
    DataFileSummary,
    DataFileUpdate,
    SampleDataFileRead,
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


async def read_data_file(
    session: AsyncSession, data_file_id: uuid.UUID, actor: Actor
) -> DataFileRead | None:
    """A data file's details, or None if it doesn't exist or the actor can't see it."""
    query = DATA_FILE_QUERY.where(DataFile.id == data_file_id, visible_studies(actor))
    row = (await session.execute(query)).one_or_none()
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
    project_code: str,
    study_code: str,
    payload: DataFileCreate,
    session: SessionDep,
    actor: ActorDep,
) -> DataFileRead:
    """Record a data file in a study. A URI can be recorded only once in each study."""
    study = await get_study_or_404(session, project_code, study_code, actor)
    await require_study_role(session, actor, study, "editor")
    assay_name = await assay_name_in_study(session, study.id, payload.assay_id)
    data_file = DataFile(study_id=study.id, created_by=actor.label, **payload.model_dump())
    session.add(data_file)
    try:
        await session.flush()
    except IntegrityError as exc:
        await session.rollback()
        if is_external_id_conflict(exc):
            raise external_id_conflict(
                "data file", payload.external_id, f"in study {study_code!r}"
            ) from exc
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A file with this URI is already recorded in study {study_code!r}",
        ) from exc
    await record_event(
        session,
        action="create",
        entity_type="data_file",
        entity_id=data_file.id,
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
    await session.refresh(data_file)
    return data_file_read(data_file, project_code, study_code, assay_name, 0)


@router.get("/projects/{project_code}/studies/{study_code}/data-files")
async def list_data_files(
    project_code: str,
    study_code: str,
    session: SessionDep,
    actor: ActorDep,
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
    study = await get_study_or_404(session, project_code, study_code, actor)
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
async def get_data_file(
    data_file_id: uuid.UUID, session: SessionDep, actor: ActorDep
) -> DataFileRead:
    """Get one data file by its permanent ID."""
    found = await read_data_file(session, data_file_id, actor)
    if found is None:
        raise not_found(data_file_id)
    return found


@router.patch("/data-files/{data_file_id}")
async def update_data_file(
    data_file_id: uuid.UUID, payload: DataFileUpdate, session: SessionDep, actor: ActorDep
) -> DataFileRead:
    """Change some of a data file's details. Only the fields sent are changed; null clears one."""
    data_file = await session.get(DataFile, data_file_id)
    if data_file is None or not await can_see_study(session, actor, data_file.study_id):
        raise not_found(data_file_id)
    await require_editor_of(session, actor, data_file.study_id)

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
            if is_external_id_conflict(exc):
                raise external_id_conflict(
                    "data file", payload.external_id, "in this study"
                ) from exc
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A file with this URI is already recorded in this study",
            ) from exc
        await record_event(
            session,
            action="update",
            entity_type="data_file",
            entity_id=data_file.id,
            actor=actor.label,
            changes={
                "before": {field: before[field] for field in changed},
                "after": payload.model_dump(mode="json", include=set(changed)),
            },
        )
        await session.commit()

    updated = await read_data_file(session, data_file_id, actor)
    assert updated is not None  # It was found above, and records are never deleted.
    return updated


DataFileSampleSort = Literal["name", "-name", "label", "-label"]

DATA_FILE_SAMPLE_SORT_COLUMNS: dict[str, InstrumentedAttribute[Any]] = {
    "name": Sample.name,
    "label": DataFileSample.label,
}


async def get_data_file_or_404(
    session: AsyncSession, data_file_id: uuid.UUID, actor: Actor
) -> DataFile:
    """Find a data file, or respond with 404. One in a study the actor can't see is not found."""
    data_file = await session.get(DataFile, data_file_id)
    if data_file is None or not await can_see_study(session, actor, data_file.study_id):
        raise not_found(data_file_id)
    return data_file


def linked_sample_read(sample: Sample, label: str | None) -> DataFileSampleRead:
    return DataFileSampleRead(
        sample_id=sample.id,
        sample_name=sample.name,
        external_id=sample.external_id,
        material_type=sample.material_type,
        status=sample.status,
        label=label,
    )


@router.get("/data-files/{data_file_id}/samples")
async def list_data_file_samples(
    data_file_id: uuid.UUID,
    session: SessionDep,
    actor: ActorDep,
    q: Annotated[
        str | None,
        Query(max_length=200, description="Search sample names and external IDs, ignoring case"),
    ] = None,
    sort: Annotated[
        DataFileSampleSort,
        Query(description="The column to sort by; a leading - reverses the order"),
    ] = "name",
    limit: Annotated[int, Query(ge=1, le=500)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> Page[DataFileSampleRead]:
    """List the samples whose data is in a file, a page at a time, with the total that match."""
    await get_data_file_or_404(session, data_file_id, actor)
    conditions: list[ColumnElement[bool]] = [DataFileSample.data_file_id == data_file_id]
    if q:
        conditions.append(
            or_(
                Sample.name.icontains(q, autoescape=True),
                Sample.external_id.icontains(q, autoescape=True),
            )
        )
    count_query = (
        select(func.count())
        .select_from(DataFileSample)
        .join(Sample, DataFileSample.sample_id == Sample.id)
        .where(*conditions)
    )
    total = (await session.execute(count_query)).scalar_one()

    column = DATA_FILE_SAMPLE_SORT_COLUMNS[sort.removeprefix("-")]
    order = column.desc() if sort.startswith("-") else column.asc()
    result = await session.execute(
        select(Sample, DataFileSample.label)
        .join(DataFileSample, DataFileSample.sample_id == Sample.id)
        .where(*conditions)
        .order_by(order.nulls_last(), Sample.name, Sample.id)
        .limit(limit)
        .offset(offset)
    )
    return Page[DataFileSampleRead](
        items=[linked_sample_read(sample, label) for sample, label in result],
        total=total,
    )


@router.put("/data-files/{data_file_id}/samples/{sample_id}")
async def link_data_file_sample(
    data_file_id: uuid.UUID,
    sample_id: uuid.UUID,
    payload: DataFileSampleLink,
    session: SessionDep,
    actor: ActorDep,
    response: Response,
) -> DataFileSampleRead:
    """Record that a file holds a sample's data, or change the sample's label in it.

    Returns 201 when the link is new and 200 when it already existed, so it's safe to repeat.
    """
    data_file = await get_data_file_or_404(session, data_file_id, actor)
    await require_editor_of(session, actor, data_file.study_id)
    sample = await session.get(Sample, sample_id)
    if sample is None or sample.study_id != data_file.study_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="The sample must be an existing sample in the same study",
        )
    which = {"sample_id": str(sample.id), "sample": sample.name}

    link = await session.get(DataFileSample, (data_file_id, sample_id))
    if link is None:
        session.add(
            DataFileSample(
                data_file_id=data_file_id,
                sample_id=sample_id,
                label=payload.label,
                created_by=actor.label,
            )
        )
        await record_event(
            session,
            action="add_sample",
            entity_type="data_file",
            entity_id=data_file_id,
            actor=actor.label,
            changes={"after": {**which, "label": payload.label}},
        )
        response.status_code = status.HTTP_201_CREATED
    elif link.label != payload.label:
        await record_event(
            session,
            action="update_sample",
            entity_type="data_file",
            entity_id=data_file_id,
            actor=actor.label,
            changes={
                "before": {**which, "label": link.label},
                "after": {**which, "label": payload.label},
            },
        )
        link.label = payload.label
        link.updated_at = datetime.now(UTC)

    result = linked_sample_read(sample, payload.label)
    await session.commit()
    return result


@router.delete(
    "/data-files/{data_file_id}/samples/{sample_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def unlink_data_file_sample(
    data_file_id: uuid.UUID, sample_id: uuid.UUID, session: SessionDep, actor: ActorDep
) -> None:
    """Remove a sample from a data file."""
    data_file = await get_data_file_or_404(session, data_file_id, actor)
    await require_editor_of(session, actor, data_file.study_id)
    link = await session.get(DataFileSample, (data_file_id, sample_id))
    if link is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sample {sample_id} is not linked to data file {data_file_id}",
        )
    sample_name = await session.scalar(select(Sample.name).where(Sample.id == sample_id))
    await record_event(
        session,
        action="remove_sample",
        entity_type="data_file",
        entity_id=data_file_id,
        actor=actor.label,
        changes={
            "before": {"sample_id": str(sample_id), "sample": sample_name, "label": link.label}
        },
    )
    await session.delete(link)
    await session.commit()


@router.get("/samples/{sample_id}/data-files")
async def list_sample_data_files(
    sample_id: uuid.UUID, session: SessionDep, actor: ActorDep
) -> list[SampleDataFileRead]:
    """List the data files a sample appears in, by name."""
    sample = await session.get(Sample, sample_id)
    if sample is None or not await can_see_study(session, actor, sample.study_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sample {sample_id} not found",
        )
    result = await session.execute(
        select(DataFile, DataFileSample.label)
        .join(DataFileSample, DataFileSample.data_file_id == DataFile.id)
        .where(DataFileSample.sample_id == sample_id)
        .order_by(DataFile.name, DataFile.id)
    )
    return [
        SampleDataFileRead(
            data_file_id=data_file.id,
            name=data_file.name,
            level=data_file.level,
            format=data_file.format,
            uri=data_file.uri,
            label=label,
        )
        for data_file, label in result
    ]


async def is_derived_from(
    session: AsyncSession, file_id: uuid.UUID, ancestor_id: uuid.UUID
) -> bool:
    """Whether file_id was derived from ancestor_id, directly or through other files."""
    seen: set[uuid.UUID] = set()
    frontier = {file_id}
    while frontier:
        if ancestor_id in frontier:
            return True
        seen |= frontier
        inputs = await session.scalars(
            select(DataFileInput.input_data_file_id).where(DataFileInput.data_file_id.in_(frontier))
        )
        frontier = set(inputs) - seen
    return False


@router.get("/data-files/{data_file_id}/inputs")
async def list_inputs(
    data_file_id: uuid.UUID, session: SessionDep, actor: ActorDep
) -> list[DataFileSummary]:
    """List the files this file was derived from, by name."""
    await get_data_file_or_404(session, data_file_id, actor)
    result = await session.scalars(
        select(DataFile)
        .join(DataFileInput, DataFileInput.input_data_file_id == DataFile.id)
        .where(DataFileInput.data_file_id == data_file_id)
        .order_by(DataFile.name, DataFile.id)
    )
    return [DataFileSummary.model_validate(data_file) for data_file in result]


@router.get("/data-files/{data_file_id}/outputs")
async def list_outputs(
    data_file_id: uuid.UUID, session: SessionDep, actor: ActorDep
) -> list[DataFileSummary]:
    """List the files derived from this file, by name."""
    await get_data_file_or_404(session, data_file_id, actor)
    result = await session.scalars(
        select(DataFile)
        .join(DataFileInput, DataFileInput.data_file_id == DataFile.id)
        .where(DataFileInput.input_data_file_id == data_file_id)
        .order_by(DataFile.name, DataFile.id)
    )
    return [DataFileSummary.model_validate(data_file) for data_file in result]


@router.put("/data-files/{data_file_id}/inputs/{input_id}")
async def add_input(
    data_file_id: uuid.UUID,
    input_id: uuid.UUID,
    session: SessionDep,
    actor: ActorDep,
    response: Response,
) -> DataFileSummary:
    """Record that a file was derived from another file in the same study.

    Returns 201 when this is new and 200 when it was already recorded, so it's safe to repeat.
    """
    data_file = await get_data_file_or_404(session, data_file_id, actor)
    await require_editor_of(session, actor, data_file.study_id)
    source = await session.get(DataFile, input_id)
    if source is None or source.study_id != data_file.study_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="The input must be an existing data file in the same study",
        )
    if input_id == data_file_id or await is_derived_from(session, input_id, data_file_id):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="A file can't be derived from itself or from a file derived from it",
        )

    if await session.get(DataFileInput, (data_file_id, input_id)) is None:
        session.add(
            DataFileInput(
                data_file_id=data_file_id, input_data_file_id=input_id, created_by=actor.label
            )
        )
        await record_event(
            session,
            action="add_input",
            entity_type="data_file",
            entity_id=data_file_id,
            actor=actor.label,
            changes={"after": {"input_id": str(input_id), "input": source.name}},
        )
        response.status_code = status.HTTP_201_CREATED

    result = DataFileSummary.model_validate(source)
    await session.commit()
    return result


@router.delete(
    "/data-files/{data_file_id}/inputs/{input_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def remove_input(
    data_file_id: uuid.UUID, input_id: uuid.UUID, session: SessionDep, actor: ActorDep
) -> None:
    """Remove the record that a file was derived from another."""
    data_file = await get_data_file_or_404(session, data_file_id, actor)
    await require_editor_of(session, actor, data_file.study_id)
    link = await session.get(DataFileInput, (data_file_id, input_id))
    if link is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Data file {data_file_id} is not recorded as derived from {input_id}",
        )
    input_name = await session.scalar(select(DataFile.name).where(DataFile.id == input_id))
    await record_event(
        session,
        action="remove_input",
        entity_type="data_file",
        entity_id=data_file_id,
        actor=actor.label,
        changes={"before": {"input_id": str(input_id), "input": input_name}},
    )
    await session.delete(link)
    await session.commit()
