"""Bulk import of a study's subjects and samples.

The rules are in the endpoint's description, which the API docs show.
"""

import uuid
from typing import Any, Literal

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from protolims_api.audit import record_event
from protolims_api.db import SessionDep
from protolims_api.models import Sample, Study, Subject
from protolims_api.routers.studies import get_study_or_404
from protolims_api.schemas.importing import (
    Difference,
    ImportRequest,
    ImportResult,
    SampleImport,
    SubjectImport,
)

router = APIRouter(tags=["import"])

# Where a reference by name leads: an existing record's ID, or the name of a record this
# import creates.
Target = uuid.UUID | str
Fields = dict[str, dict[str, Any]]


def find_duplicates(kind: str, what: str, values: list[str | None], problems: list[str]) -> None:
    """Report values that appear more than once in the import."""
    seen: set[str] = set()
    for value in values:
        if value is None:
            continue
        if value in seen:
            problems.append(f"{kind}: more than one has the {what} {value!r}")
        seen.add(value)


def match[R: (Subject, Sample)](
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


def match_all[I: (SubjectImport, SampleImport), R: (Subject, Sample)](
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


def targets[I: (SubjectImport, SampleImport), R: (Subject, Sample)](
    existing: list[R], matches: list[tuple[I, R | None]]
) -> dict[str, Target]:
    """Where each name a sample can refer to leads: the study's records, and the import's."""
    found: dict[str, Target] = {record.name: record.id for record in existing}
    for item, record in matches:
        found[item.name] = record.id if record is not None else item.name
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


def subject_differences(item: SubjectImport, record: Subject) -> Fields:
    """The fields the import sent that differ from what's recorded."""
    return {
        field: {"recorded": getattr(record, field), "import": value}
        for field, value in item.model_dump(exclude_unset=True).items()
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


def tally(
    result: ImportResult,
    kind: Literal["subject", "sample"],
    name: str,
    record_id: uuid.UUID,
    fields: Fields,
) -> None:
    """Count an existing record as unchanged or different, and list how it differs."""
    summary = result.subjects if kind == "subject" else result.samples
    if fields:
        summary.different += 1
        result.differences.append(Difference(kind=kind, name=name, id=record_id, fields=fields))
    else:
        summary.unchanged += 1


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
) -> None:
    """Create the samples that don't exist yet, then link them to their parents."""

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


@router.post("/projects/{project_code}/studies/{study_code}/import")
async def import_records(
    project_code: str, study_code: str, payload: ImportRequest, session: SessionDep
) -> ImportResult:
    """Import subjects and samples into a study, safely and repeatably.

    - **Matching:** each record is matched to one already in the study by its external ID (its
      ID in the source) if it has one, otherwise by its name. An ambiguous match is refused:
      for example, an external ID that belongs to one record while the name belongs to another.
    - **Existing records are never changed.** A matched record that differs from the import is
      left as it is, and the reply lists the differences for you to review. Only the fields the
      import sends are compared.
    - **New records are created.** A sample's `subject` and `parent` are names, of a record in
      the same request or one already in the study, in any order.
    - **All or nothing:** if anything is wrong, nothing is saved, and the reply (422) lists every
      problem found.
    - **Dry run:** `dry_run` must be given. With `true`, everything is checked and the reply says
      what would happen, but nothing is saved. Do a dry run first.
    - **Limits:** at most 5,000 records per request; send bigger studies in batches. An import
      never creates projects or studies.
    - **Audit trail:** each new record is recorded as created by `import: <source>`.
    """
    study = await get_study_or_404(session, project_code, study_code)
    problems: list[str] = []
    find_duplicates("subjects", "name", [s.name for s in payload.subjects], problems)
    find_duplicates("subjects", "external ID", [s.external_id for s in payload.subjects], problems)
    find_duplicates("samples", "name", [s.name for s in payload.samples], problems)
    find_duplicates("samples", "external ID", [s.external_id for s in payload.samples], problems)

    subjects = list(await session.scalars(select(Subject).where(Subject.study_id == study.id)))
    samples = list(await session.scalars(select(Sample).where(Sample.study_id == study.id)))
    subject_matches = match_all("subject", payload.subjects, subjects, problems)
    sample_matches = match_all("sample", payload.samples, samples, problems)
    subject_targets = targets(subjects, subject_matches)
    sample_targets = targets(samples, sample_matches)
    check_samples(sample_matches, subject_targets, sample_targets, problems)
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
        subjects={},
        samples={},
        differences=[],
    )
    subject_names = {subject.id: subject.name for subject in subjects}
    sample_names = {sample.id: sample.name for sample in samples}
    for subject_item, subject in subject_matches:
        if subject is None:
            result.subjects.created += 1
        else:
            fields = subject_differences(subject_item, subject)
            tally(result, "subject", subject_item.name, subject.id, fields)
    for sample_item, sample in sample_matches:
        if sample is None:
            result.samples.created += 1
        else:
            fields = sample_differences(
                sample_item, sample, subject_targets, sample_targets, subject_names, sample_names
            )
            tally(result, "sample", sample_item.name, sample.id, fields)

    actor = f"import: {payload.source}"
    where = {"project": project_code, "study": study_code}
    new_subjects = await create_subjects(session, study, actor, where, subject_matches)
    await create_samples(
        session, study, actor, where, sample_matches, subject_targets, sample_targets, new_subjects
    )
    if payload.dry_run:
        await session.rollback()
    else:
        await session.commit()
    return result
