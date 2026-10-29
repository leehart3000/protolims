"""Bulk import of a study's subjects, samples, assays and data files.

The rules are in the endpoint's description, which the API docs show.
"""

import uuid
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any, Literal

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from protolims_api.audit import record_event
from protolims_api.db import SessionDep
from protolims_api.models import (
    Assay,
    AssaySample,
    DataFile,
    DataFileInput,
    DataFileSample,
    Sample,
    Study,
    Subject,
)
from protolims_api.permissions import ActorDep, require_study_role
from protolims_api.routers.studies import get_study_or_404
from protolims_api.schemas.importing import (
    AssayImport,
    AssaySampleImport,
    DataFileImport,
    DataFileSampleImport,
    Difference,
    ImportRequest,
    ImportResult,
    KindSummary,
    SampleImport,
    SubjectImport,
)

router = APIRouter(tags=["import"])

# Where a reference leads: an existing record's ID, or the name (or, for a data file, the
# location) of a record this import creates.
Target = uuid.UUID | str
Fields = dict[str, dict[str, Any]]
Kind = Literal["subject", "sample", "assay", "assay sample", "data file", "data file sample"]
# Existing links from an assay or data file to a sample, with their labels.
Links = dict[tuple[uuid.UUID, uuid.UUID], str | None]
# Existing "this file was made from that file" links.
Inputs = set[tuple[uuid.UUID, uuid.UUID]]


@dataclass
class Existing:
    """A study's records and links, as they were before the import."""

    subjects: list[Subject]
    samples: list[Sample]
    assays: list[Assay]
    files: list[DataFile]
    assay_links: Links
    file_links: Links
    inputs: Inputs


async def load_existing(session: AsyncSession, study: Study) -> Existing:
    """Read everything in the study that the import might match or link to."""
    in_study_files = DataFile.study_id == study.id
    return Existing(
        subjects=list(await session.scalars(select(Subject).where(Subject.study_id == study.id))),
        samples=list(await session.scalars(select(Sample).where(Sample.study_id == study.id))),
        assays=list(await session.scalars(select(Assay).where(Assay.study_id == study.id))),
        files=list(await session.scalars(select(DataFile).where(in_study_files))),
        assay_links={
            (link.assay_id, link.sample_id): link.label
            for link in await session.scalars(
                select(AssaySample)
                .join(Assay, AssaySample.assay_id == Assay.id)
                .where(Assay.study_id == study.id)
            )
        },
        file_links={
            (link.data_file_id, link.sample_id): link.label
            for link in await session.scalars(
                select(DataFileSample)
                .join(DataFile, DataFileSample.data_file_id == DataFile.id)
                .where(in_study_files)
            )
        },
        inputs={
            (link.data_file_id, link.input_data_file_id)
            for link in await session.scalars(
                select(DataFileInput)
                .join(DataFile, DataFileInput.data_file_id == DataFile.id)
                .where(in_study_files)
            )
        },
    )


def find_duplicates(kind: str, what: str, values: list[str | None], problems: list[str]) -> None:
    """Report values that appear more than once in the import."""
    seen: set[str] = set()
    for value in values:
        if value is None:
            continue
        if value in seen:
            problems.append(f"{kind}: more than one has the {what} {value!r}")
        seen.add(value)


def match[R: (Subject, Sample, Assay)](
    kind: str,
    name: str,
    external_id: str | None,
    by_name: dict[str, R],
    by_external_id: dict[str, R],
    claimed: dict[uuid.UUID, str],
    problems: list[str],
) -> R | None:
    """Find the existing record an imported one is: by external ID if it has one, otherwise
    by name. Reports a problem, and returns None, if the match is ambiguous."""
    named = by_name.get(name)
    found = by_external_id.get(external_id) if external_id is not None else None
    if found is not None and named is not None and named is not found:
        problems.append(
            f"{kind} {name!r}: its external ID {external_id!r} belongs to {kind} "
            f"{found.name!r}, but its name belongs to a different {kind}"
        )
        return None
    if found is None and named is not None and external_id is not None and named.external_id:
        problems.append(
            f"{kind} {name!r}: that name is already used by a {kind} with the external ID "
            f"{named.external_id!r}"
        )
        return None
    record = found if found is not None else named
    if record is not None:
        if record.id in claimed:
            problems.append(
                f"{kind} {name!r}: matches the same existing {kind} as {claimed[record.id]!r}"
            )
            return None
        claimed[record.id] = name
    return record


def match_all[I: (SubjectImport, SampleImport, AssayImport), R: (Subject, Sample, Assay)](
    kind: str, items: list[I], existing: list[R], problems: list[str]
) -> list[tuple[I, R | None]]:
    """Pair each imported record with the existing record it is, if any."""
    by_name = {record.name: record for record in existing}
    by_external_id = {
        record.external_id: record for record in existing if record.external_id is not None
    }
    claimed: dict[uuid.UUID, str] = {}
    return [
        (item, match(kind, item.name, item.external_id, by_name, by_external_id, claimed, problems))
        for item in items
    ]


def match_files(
    items: list[DataFileImport], existing: list[DataFile], problems: list[str]
) -> list[tuple[DataFileImport, DataFile | None]]:
    """Pair each imported file with the existing file it is, if any: by external ID if it has
    one, otherwise by location. Reports a problem for an ambiguous match."""
    by_uri = {file.uri: file for file in existing}
    by_external_id = {file.external_id: file for file in existing if file.external_id is not None}
    claimed: dict[uuid.UUID, str] = {}
    matches: list[tuple[DataFileImport, DataFile | None]] = []
    for item in items:
        where = f"data file {item.uri!r}"
        located = by_uri.get(item.uri)
        found = by_external_id.get(item.external_id) if item.external_id is not None else None
        record: DataFile | None = None
        if found is not None and located is not None and located is not found:
            problems.append(
                f"{where}: its external ID {item.external_id!r} belongs to the file at "
                f"{found.uri!r}, but its location belongs to a different file"
            )
        elif found is None and located is not None and item.external_id and located.external_id:
            problems.append(
                f"{where}: that location is already used by a file with the external ID "
                f"{located.external_id!r}"
            )
        else:
            record = found if found is not None else located
            if record is not None and record.id in claimed:
                problems.append(
                    f"{where}: matches the same existing file as {claimed[record.id]!r}"
                )
                record = None
            elif record is not None:
                claimed[record.id] = item.uri
        matches.append((item, record))
    return matches


def targets[I: (SubjectImport, SampleImport, AssayImport), R: (Subject, Sample, Assay)](
    existing: list[R], matches: list[tuple[I, R | None]]
) -> dict[str, Target]:
    """Where each name a reference can use leads: the study's records, and the import's."""
    found: dict[str, Target] = {record.name: record.id for record in existing}
    for item, record in matches:
        found[item.name] = record.id if record is not None else item.name
    return found


def locations(
    existing: list[DataFile], matches: list[tuple[DataFileImport, DataFile | None]]
) -> dict[str, Target]:
    """Where each file location an input can use leads: the study's files, and the import's."""
    found: dict[str, Target] = {file.uri: file.id for file in existing}
    for item, record in matches:
        found[item.uri] = record.id if record is not None else item.uri
    return found


def derives_from_itself(name: str, new_samples: dict[str, SampleImport]) -> bool:
    """Whether a new sample's chain of parents (through other new samples) leads back to it."""
    seen = {name}
    current = new_samples[name].parent
    while current is not None and current in new_samples:
        if current in seen:
            return current == name
        seen.add(current)
        current = new_samples[current].parent
    return False


def check_samples(
    matches: list[tuple[SampleImport, Sample | None]],
    subject_targets: dict[str, Target],
    sample_targets: dict[str, Target],
    problems: list[str],
) -> None:
    """Report samples whose subject or parent can't be found, or that would form a loop."""
    for item, _ in matches:
        if item.subject is not None and item.subject not in subject_targets:
            problems.append(
                f"sample {item.name!r}: there's no subject called {item.subject!r} "
                "in the study or the import"
            )
        if item.parent is not None and item.parent not in sample_targets:
            problems.append(
                f"sample {item.name!r}: there's no sample called {item.parent!r} "
                "in the study or the import"
            )
    new_samples = {item.name: item for item, record in matches if record is None}
    for name in new_samples:
        if derives_from_itself(name, new_samples):
            problems.append(
                f"sample {name!r}: it would be derived from itself, directly or through "
                "other samples"
            )


def check_sample_links(
    where: str,
    links: Sequence[AssaySampleImport | DataFileSampleImport],
    sample_targets: dict[str, Target],
    problems: list[str],
) -> None:
    """Report a sample listed twice, or one that can't be found."""
    seen: set[str] = set()
    for link in links:
        if link.sample in seen:
            problems.append(f"{where}: lists sample {link.sample!r} more than once")
        seen.add(link.sample)
        if link.sample not in sample_targets:
            problems.append(
                f"{where}: there's no sample called {link.sample!r} in the study or the import"
            )


def check_assays(
    matches: list[tuple[AssayImport, Assay | None]],
    sample_targets: dict[str, Target],
    problems: list[str],
) -> None:
    """Report assays that list a sample twice, or a sample that can't be found."""
    for item, _ in matches:
        check_sample_links(f"assay {item.name!r}", item.samples, sample_targets, problems)


def check_files(
    matches: list[tuple[DataFileImport, DataFile | None]],
    assay_targets: dict[str, Target],
    sample_targets: dict[str, Target],
    file_targets: dict[str, Target],
    problems: list[str],
) -> None:
    """Report files whose assay, samples or inputs can't be found, or are listed twice."""
    for item, _ in matches:
        where = f"data file {item.uri!r}"
        if item.assay is not None and item.assay not in assay_targets:
            problems.append(
                f"{where}: there's no assay called {item.assay!r} in the study or the import"
            )
        check_sample_links(where, item.samples, sample_targets, problems)
        seen: set[str] = set()
        for uri in item.inputs:
            if uri in seen:
                problems.append(f"{where}: lists the input {uri!r} more than once")
            seen.add(uri)
            if uri not in file_targets:
                problems.append(
                    f"{where}: there's no data file at {uri!r} in the study or the import"
                )


def leads_back(graph: dict[Target, set[Target]], start: Target) -> bool:
    """Whether following a file's inputs, and theirs, ever comes back to it."""
    seen: set[Target] = set()
    frontier = set(graph.get(start, set()))
    while frontier:
        if start in frontier:
            return True
        seen |= frontier
        frontier = {found for node in frontier for found in graph.get(node, set())} - seen
    return False


def check_file_loops(
    matches: list[tuple[DataFileImport, DataFile | None]],
    file_targets: dict[str, Target],
    inputs: Inputs,
    problems: list[str],
) -> None:
    """Report files that, with the existing and imported inputs together, would be derived
    from themselves."""
    graph: dict[Target, set[Target]] = {}
    for file_id, input_id in inputs:
        graph.setdefault(file_id, set()).add(input_id)
    for item, _ in matches:
        node = file_targets[item.uri]
        for uri in item.inputs:
            if uri in file_targets:
                graph.setdefault(node, set()).add(file_targets[uri])
    reported: set[Target] = set()
    for item, _ in matches:
        node = file_targets[item.uri]
        if node in reported:
            continue
        if leads_back(graph, node):
            reported.add(node)
            problems.append(
                f"data file {item.uri!r}: it would be derived from itself, directly or through "
                "other files"
            )


def plain_differences(item: SubjectImport | AssayImport, record: Subject | Assay) -> Fields:
    """The fields the import sent that differ from what's recorded."""
    return {
        field: {"recorded": getattr(record, field), "import": value}
        for field, value in item.model_dump(exclude_unset=True, exclude={"samples"}).items()
        if getattr(record, field) != value
    }


def sample_differences(
    item: SampleImport,
    record: Sample,
    subject_targets: dict[str, Target],
    sample_targets: dict[str, Target],
    subject_names: dict[uuid.UUID, str],
    sample_names: dict[uuid.UUID, str],
) -> Fields:
    """The fields the import sent that differ from what's recorded, with links shown by name."""
    references = {
        "subject": (record.subject_id, subject_targets, subject_names),
        "parent": (record.parent_sample_id, sample_targets, sample_names),
    }
    fields: Fields = {}
    for field, value in item.model_dump(exclude_unset=True).items():
        if field in references:
            current, found, names = references[field]
            wanted = None if value is None else found[value]
            if current != wanted:
                recorded = None if current is None else names[current]
                fields[field] = {"recorded": recorded, "import": value}
        elif getattr(record, field) != value:
            fields[field] = {"recorded": getattr(record, field), "import": value}
    return fields


def file_differences(
    item: DataFileImport,
    record: DataFile,
    assay_targets: dict[str, Target],
    assay_names: dict[uuid.UUID, str],
) -> Fields:
    """The fields the import sent that differ from what's recorded, with the assay by name."""
    fields: Fields = {}
    for field, value in item.model_dump(exclude_unset=True, exclude={"samples", "inputs"}).items():
        if field == "assay":
            wanted = None if value is None else assay_targets[value]
            if record.assay_id != wanted:
                recorded = None if record.assay_id is None else assay_names[record.assay_id]
                fields["assay"] = {"recorded": recorded, "import": value}
        elif getattr(record, field) != value:
            fields[field] = {"recorded": getattr(record, field), "import": value}
    return fields


def tally(
    result: ImportResult,
    summary: KindSummary,
    kind: Kind,
    name: str,
    record_id: uuid.UUID,
    fields: Fields,
) -> None:
    """Count an existing record as unchanged or different, and list how it differs."""
    if fields:
        summary.different += 1
        result.differences.append(Difference(kind=kind, name=name, id=record_id, fields=fields))
    else:
        summary.unchanged += 1


def tally_sample_links(
    result: ImportResult,
    summary: KindSummary,
    kind: Kind,
    owner: str,
    record_id: uuid.UUID | None,
    links: Sequence[AssaySampleImport | DataFileSampleImport],
    sample_targets: dict[str, Target],
    existing: Links,
) -> None:
    """Count an assay's or file's sample links as new, unchanged or (by label) different."""
    for link in links:
        target = sample_targets[link.sample]
        key = (
            (record_id, target) if record_id is not None and isinstance(target, uuid.UUID) else None
        )
        if key is None or key not in existing:
            summary.created += 1
        elif "label" in link.model_fields_set and existing[key] != link.label:
            fields = {"label": {"recorded": existing[key], "import": link.label}}
            tally(result, summary, kind, f"{owner} / {link.sample}", key[0], fields)
        else:
            summary.unchanged += 1


def tally_inputs(
    result: ImportResult,
    item: DataFileImport,
    record: DataFile | None,
    file_targets: dict[str, Target],
    inputs: Inputs,
) -> None:
    """Count a file's inputs as new or unchanged."""
    for uri in item.inputs:
        target = file_targets[uri]
        if record is not None and isinstance(target, uuid.UUID) and (record.id, target) in inputs:
            result.data_file_inputs.unchanged += 1
        else:
            result.data_file_inputs.created += 1


async def create_subjects(
    session: AsyncSession,
    study: Study,
    actor: str,
    where: dict[str, str],
    matches: list[tuple[SubjectImport, Subject | None]],
) -> dict[str, Subject]:
    """Create the subjects that don't exist yet; return them by name."""
    created: dict[str, tuple[SubjectImport, Subject]] = {}
    for item, record in matches:
        if record is None:
            subject = Subject(study_id=study.id, created_by=actor, **item.model_dump())
            session.add(subject)
            created[item.name] = (item, subject)
    await session.flush()
    for item, subject in created.values():
        await record_event(
            session,
            action="create",
            entity_type="subject",
            entity_id=subject.id,
            actor=actor,
            changes={"after": {**where, **item.model_dump(mode="json")}},
        )
    return {name: subject for name, (_, subject) in created.items()}


async def create_samples(
    session: AsyncSession,
    study: Study,
    actor: str,
    where: dict[str, str],
    matches: list[tuple[SampleImport, Sample | None]],
    subject_targets: dict[str, Target],
    sample_targets: dict[str, Target],
    new_subjects: dict[str, Subject],
) -> dict[str, Sample]:
    """Create the samples that don't exist yet, link them to their parents, and return them."""

    def subject_id(name: str | None) -> uuid.UUID | None:
        if name is None:
            return None
        target = subject_targets[name]
        return target if isinstance(target, uuid.UUID) else new_subjects[target].id

    created: dict[str, tuple[SampleImport, Sample]] = {}
    for item, record in matches:
        if record is None:
            sample = Sample(
                study_id=study.id,
                created_by=actor,
                subject_id=subject_id(item.subject),
                **item.model_dump(exclude={"subject", "parent"}),
            )
            session.add(sample)
            created[item.name] = (item, sample)
    await session.flush()
    for item, sample in created.values():
        if item.parent is not None:
            target = sample_targets[item.parent]
            sample.parent_sample_id = (
                target if isinstance(target, uuid.UUID) else created[target][1].id
            )
        await record_event(
            session,
            action="create",
            entity_type="sample",
            entity_id=sample.id,
            actor=actor,
            changes={"after": {**where, **item.model_dump(mode="json")}},
        )
    await session.flush()
    return {name: sample for name, (_, sample) in created.items()}


async def create_assays(
    session: AsyncSession,
    study: Study,
    actor: str,
    where: dict[str, str],
    matches: list[tuple[AssayImport, Assay | None]],
) -> dict[str, Assay]:
    """Create the assays that don't exist yet; return them by name."""
    created: dict[str, tuple[AssayImport, Assay]] = {}
    for item, record in matches:
        if record is None:
            assay = Assay(
                study_id=study.id, created_by=actor, **item.model_dump(exclude={"samples"})
            )
            session.add(assay)
            created[item.name] = (item, assay)
    await session.flush()
    for item, assay in created.values():
        await record_event(
            session,
            action="create",
            entity_type="assay",
            entity_id=assay.id,
            actor=actor,
            changes={"after": {**where, **item.model_dump(mode="json", exclude={"samples"})}},
        )
    return {name: assay for name, (_, assay) in created.items()}


async def create_assay_samples(
    session: AsyncSession,
    actor: str,
    matches: list[tuple[AssayImport, Assay | None]],
    new_assays: dict[str, Assay],
    sample_targets: dict[str, Target],
    new_samples: dict[str, Sample],
    links: Links,
) -> None:
    """Add the assay-sample links that don't exist yet. Existing links are left as they are."""
    for item, record in matches:
        assay = record if record is not None else new_assays[item.name]
        for link in item.samples:
            target = sample_targets[link.sample]
            sample_id = target if isinstance(target, uuid.UUID) else new_samples[target].id
            if (assay.id, sample_id) in links:
                continue
            session.add(
                AssaySample(
                    assay_id=assay.id, sample_id=sample_id, label=link.label, created_by=actor
                )
            )
            await record_event(
                session,
                action="add_sample",
                entity_type="assay",
                entity_id=assay.id,
                actor=actor,
                changes={
                    "after": {
                        "sample_id": str(sample_id),
                        "sample": link.sample,
                        "label": link.label,
                    }
                },
            )
    await session.flush()


async def create_data_files(
    session: AsyncSession,
    study: Study,
    actor: str,
    where: dict[str, str],
    matches: list[tuple[DataFileImport, DataFile | None]],
    assay_targets: dict[str, Target],
    new_assays: dict[str, Assay],
) -> dict[str, DataFile]:
    """Create the data files that don't exist yet; return them by location."""

    def assay_id(name: str | None) -> uuid.UUID | None:
        if name is None:
            return None
        target = assay_targets[name]
        return target if isinstance(target, uuid.UUID) else new_assays[target].id

    created: dict[str, tuple[DataFileImport, DataFile]] = {}
    for item, record in matches:
        if record is None:
            data_file = DataFile(
                study_id=study.id,
                created_by=actor,
                assay_id=assay_id(item.assay),
                **item.model_dump(exclude={"assay", "samples", "inputs"}),
            )
            session.add(data_file)
            created[item.uri] = (item, data_file)
    await session.flush()
    for item, data_file in created.values():
        await record_event(
            session,
            action="create",
            entity_type="data_file",
            entity_id=data_file.id,
            actor=actor,
            changes={
                "after": {**where, **item.model_dump(mode="json", exclude={"samples", "inputs"})}
            },
        )
    return {uri: data_file for uri, (_, data_file) in created.items()}


async def create_file_links(
    session: AsyncSession,
    actor: str,
    matches: list[tuple[DataFileImport, DataFile | None]],
    new_files: dict[str, DataFile],
    sample_targets: dict[str, Target],
    new_samples: dict[str, Sample],
    file_targets: dict[str, Target],
    existing: Existing,
) -> None:
    """Add the file-sample and file-input links that don't exist yet. Existing links are left
    as they are."""
    for item, record in matches:
        data_file = record if record is not None else new_files[item.uri]
        for link in item.samples:
            target = sample_targets[link.sample]
            sample_id = target if isinstance(target, uuid.UUID) else new_samples[target].id
            if (data_file.id, sample_id) in existing.file_links:
                continue
            session.add(
                DataFileSample(
                    data_file_id=data_file.id,
                    sample_id=sample_id,
                    label=link.label,
                    created_by=actor,
                )
            )
            await record_event(
                session,
                action="add_sample",
                entity_type="data_file",
                entity_id=data_file.id,
                actor=actor,
                changes={
                    "after": {
                        "sample_id": str(sample_id),
                        "sample": link.sample,
                        "label": link.label,
                    }
                },
            )
        for uri in item.inputs:
            target = file_targets[uri]
            input_id = target if isinstance(target, uuid.UUID) else new_files[target].id
            if (data_file.id, input_id) in existing.inputs:
                continue
            session.add(
                DataFileInput(
                    data_file_id=data_file.id, input_data_file_id=input_id, created_by=actor
                )
            )
            await record_event(
                session,
                action="add_input",
                entity_type="data_file",
                entity_id=data_file.id,
                actor=actor,
                changes={"after": {"input_id": str(input_id), "input": uri}},
            )
    await session.flush()


@router.post("/projects/{project_code}/studies/{study_code}/import")
async def import_records(
    project_code: str,
    study_code: str,
    payload: ImportRequest,
    session: SessionDep,
    actor: ActorDep,
) -> ImportResult:
    """Import subjects, samples, assays and data files into a study, safely and repeatably.

    - **Matching:** each record is matched to one already in the study by its external ID (its
      ID in the source) if it has one, otherwise by its name (a data file's location, `uri`, as
      file names often repeat). An ambiguous match is refused: for example, an external ID
      that belongs to one record while the name belongs to another.
    - **Existing records are never changed.** A matched record that differs from the import is
      left as it is, and the reply lists the differences for you to review. Only the fields the
      import sends are compared.
    - **New records are created.** A sample's `subject` and `parent` are names, of a record in
      the same request or one already in the study, in any order.
    - **Assays and their samples:** an assay lists the samples it measured by name, each with
      an optional label. A missing link is added, even to an existing assay. An existing link
      with a different label is reported, not changed. Links the import doesn't mention are
      left alone.
    - **Data files:** a file gives its `assay` and `samples` by name, and the files it was made
      from (`inputs`) by location. Links follow the same rules as an assay's. A file can't be
      derived from itself, directly or through other files.
    - **All or nothing:** if anything is wrong, nothing is saved, and the reply (422) lists every
      problem found.
    - **Dry run:** `dry_run` must be given. With `true`, everything is checked and the reply says
      what would happen, but nothing is saved. Do a dry run first.
    - **Limits:** at most 5,000 records and links per request; send bigger studies in batches.
      An import never creates projects or studies.
    - **Who can import:** the study's editors and admins.
    - **Audit trail:** each new record and link is recorded as made by whoever imported it,
      and each new record's audit entry names the import's `source`.
    """
    study = await get_study_or_404(session, project_code, study_code, actor)
    await require_study_role(session, actor, study, "editor")
    problems: list[str] = []
    for kind, items in (
        ("subjects", payload.subjects),
        ("samples", payload.samples),
        ("assays", payload.assays),
    ):
        find_duplicates(kind, "name", [item.name for item in items], problems)
        find_duplicates(kind, "external ID", [item.external_id for item in items], problems)
    files = payload.data_files
    find_duplicates("data files", "location", [file.uri for file in files], problems)
    find_duplicates("data files", "external ID", [file.external_id for file in files], problems)

    existing = await load_existing(session, study)
    subject_matches = match_all("subject", payload.subjects, existing.subjects, problems)
    sample_matches = match_all("sample", payload.samples, existing.samples, problems)
    assay_matches = match_all("assay", payload.assays, existing.assays, problems)
    file_matches = match_files(files, existing.files, problems)
    subject_targets = targets(existing.subjects, subject_matches)
    sample_targets = targets(existing.samples, sample_matches)
    assay_targets = targets(existing.assays, assay_matches)
    file_targets = locations(existing.files, file_matches)
    check_samples(sample_matches, subject_targets, sample_targets, problems)
    check_assays(assay_matches, sample_targets, problems)
    check_files(file_matches, assay_targets, sample_targets, file_targets, problems)
    check_file_loops(file_matches, file_targets, existing.inputs, problems)
    if problems:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={
                "message": "Nothing was imported, because of these problems.",
                "problems": problems,
            },
        )

    result = ImportResult(
        dry_run=payload.dry_run,
        saved=not payload.dry_run,
        subjects=KindSummary(),
        samples=KindSummary(),
        assays=KindSummary(),
        assay_samples=KindSummary(),
        data_files=KindSummary(),
        data_file_samples=KindSummary(),
        data_file_inputs=KindSummary(),
        differences=[],
    )
    subject_names = {subject.id: subject.name for subject in existing.subjects}
    sample_names = {sample.id: sample.name for sample in existing.samples}
    assay_names = {assay.id: assay.name for assay in existing.assays}
    for subject_item, subject in subject_matches:
        if subject is None:
            result.subjects.created += 1
        else:
            fields = plain_differences(subject_item, subject)
            tally(result, result.subjects, "subject", subject_item.name, subject.id, fields)
    for sample_item, sample in sample_matches:
        if sample is None:
            result.samples.created += 1
        else:
            fields = sample_differences(
                sample_item, sample, subject_targets, sample_targets, subject_names, sample_names
            )
            tally(result, result.samples, "sample", sample_item.name, sample.id, fields)
    for assay_item, assay in assay_matches:
        if assay is None:
            result.assays.created += 1
        else:
            fields = plain_differences(assay_item, assay)
            tally(result, result.assays, "assay", assay_item.name, assay.id, fields)
        tally_sample_links(
            result,
            result.assay_samples,
            "assay sample",
            assay_item.name,
            assay.id if assay is not None else None,
            assay_item.samples,
            sample_targets,
            existing.assay_links,
        )
    for file_item, data_file in file_matches:
        if data_file is None:
            result.data_files.created += 1
        else:
            fields = file_differences(file_item, data_file, assay_targets, assay_names)
            tally(result, result.data_files, "data file", file_item.uri, data_file.id, fields)
        tally_sample_links(
            result,
            result.data_file_samples,
            "data file sample",
            file_item.uri,
            data_file.id if data_file is not None else None,
            file_item.samples,
            sample_targets,
            existing.file_links,
        )
        tally_inputs(result, file_item, data_file, file_targets, existing.inputs)

    # Only signed-in people can be editors, so there's always someone to name.
    by = actor.label
    assert by is not None
    where = {"project": project_code, "study": study_code, "import": payload.source}
    new_subjects = await create_subjects(session, study, by, where, subject_matches)
    new_samples = await create_samples(
        session, study, by, where, sample_matches, subject_targets, sample_targets, new_subjects
    )
    new_assays = await create_assays(session, study, by, where, assay_matches)
    await create_assay_samples(
        session, by, assay_matches, new_assays, sample_targets, new_samples, existing.assay_links
    )
    new_files = await create_data_files(
        session, study, by, where, file_matches, assay_targets, new_assays
    )
    await create_file_links(
        session, by, file_matches, new_files, sample_targets, new_samples, file_targets, existing
    )
    if payload.dry_run:
        await session.rollback()
    else:
        await session.commit()
    return result
