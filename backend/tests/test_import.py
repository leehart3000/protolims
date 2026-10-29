"""Tests for importing a study's subjects and samples."""

from typing import Any

from fastapi.testclient import TestClient
from helpers import BY_SITE_ADMIN
from sqlalchemy import Engine, text

API = "/api/v1"

PATIENT = {
    "name": "P-01",
    "external_id": "case-1",
    "subject_type": "patient",
    "species": "Homo sapiens",
}
TUMOUR = {"name": "T-01", "external_id": "sample-1", "subject": "P-01", "material_type": "tissue"}
RNA = {"name": "T-01-RNA", "external_id": "aliquot-1", "parent": "T-01", "material_type": "RNA"}
ASSAY = {
    "name": "Run-1",
    "external_id": "run-1",
    "measurement_type": "transcription profiling",
    "technology_type": "nucleotide sequencing",
    "samples": [{"sample": "T-01-RNA", "label": "lane 1"}],
}
READS = {
    "name": "reads.fastq",
    "external_id": "file-1",
    "uri": "https://example.org/reads.fastq",
    "level": "raw",
    "format": "FASTQ",
    "assay": "Run-1",
    "samples": [{"sample": "T-01-RNA", "label": "lane 1"}],
}
COUNTS = {
    "name": "counts.tsv",
    "uri": "https://example.org/counts.tsv",
    "level": "processed",
    "format": "TSV",
    "samples": [{"sample": "T-01-RNA", "label": "column 1"}],
    "inputs": ["https://example.org/reads.fastq"],
}
FILE_A = {
    "name": "a.bam",
    "external_id": "file-a",
    "uri": "https://example.org/a.bam",
    "level": "raw",
    "format": "BAM",
}
FILE_B = {**FILE_A, "name": "b.bam", "external_id": "file-b", "uri": "https://example.org/b.bam"}


def create_study(client: TestClient, project: str = "P1", study: str = "S1") -> str:
    """Create a study (and its project, if needed); return the study's URL."""
    client.post(f"{API}/projects", json={"code": project, "name": f"Project {project}"})
    response = client.post(
        f"{API}/projects/{project}/studies", json={"code": study, "title": f"Study {study}"}
    )
    assert response.status_code == 201
    return f"{API}/projects/{project}/studies/{study}"


def run_import(
    client: TestClient,
    study_url: str,
    *,
    dry_run: bool = False,
    subjects: list[dict[str, Any]] | None = None,
    samples: list[dict[str, Any]] | None = None,
    assays: list[dict[str, Any]] | None = None,
    data_files: list[dict[str, Any]] | None = None,
) -> Any:
    return client.post(
        f"{study_url}/import",
        json={
            "source": "test",
            "dry_run": dry_run,
            "subjects": subjects or [],
            "samples": samples or [],
            "assays": assays or [],
            "data_files": data_files or [],
        },
    )


def names(client: TestClient, study_url: str, kind: str) -> list[str]:
    response = client.get(f"{study_url}/{kind}", params={"limit": 500})
    return [item["name"] for item in response.json()["items"]]


def by_name(client: TestClient, study_url: str, kind: str) -> dict[str, Any]:
    response = client.get(f"{study_url}/{kind}", params={"limit": 500})
    return {item["name"]: item for item in response.json()["items"]}


def audit_actors(database: Engine) -> list[str]:
    with database.connect() as conn:
        return list(
            conn.execute(
                text(
                    "SELECT actor FROM audit_event"
                    " WHERE entity_type IN ('subject', 'sample') ORDER BY occurred_at, id"
                )
            ).scalars()
        )


def test_import_creates_subjects_and_samples(client: TestClient, database: Engine) -> None:
    study = create_study(client)
    response = run_import(client, study, subjects=[PATIENT], samples=[RNA, TUMOUR])

    assert response.status_code == 200, response.json()
    body = response.json()
    assert (body["dry_run"], body["saved"]) == (False, True)
    assert body["subjects"] == {"created": 1, "unchanged": 0, "different": 0}
    assert body["samples"] == {"created": 2, "unchanged": 0, "different": 0}
    assert body["differences"] == []

    samples = by_name(client, study, "samples")
    assert samples["T-01"]["subject_name"] == "P-01"
    assert samples["T-01-RNA"]["parent_sample_name"] == "T-01"
    assert samples["T-01"]["created_by"] == BY_SITE_ADMIN
    assert audit_actors(database) == [BY_SITE_ADMIN] * 3


def test_import_can_refer_to_records_already_in_the_study(client: TestClient) -> None:
    study = create_study(client)
    run_import(client, study, subjects=[PATIENT], samples=[TUMOUR])

    second = {"name": "T-02", "subject": "P-01", "material_type": "tissue"}
    response = run_import(client, study, samples=[RNA, second])

    assert response.json()["samples"] == {"created": 2, "unchanged": 0, "different": 0}
    samples = by_name(client, study, "samples")
    assert samples["T-01-RNA"]["parent_sample_name"] == "T-01"
    assert samples["T-02"]["subject_name"] == "P-01"


def test_a_dry_run_reports_without_saving(client: TestClient, database: Engine) -> None:
    study = create_study(client)
    response = run_import(client, study, dry_run=True, subjects=[PATIENT], samples=[TUMOUR, RNA])

    body = response.json()
    assert (body["dry_run"], body["saved"]) == (True, False)
    assert body["subjects"]["created"] == 1
    assert body["samples"]["created"] == 2
    assert names(client, study, "subjects") == []
    assert names(client, study, "samples") == []
    assert audit_actors(database) == []


def test_importing_again_changes_nothing(client: TestClient, database: Engine) -> None:
    study = create_study(client)
    assert run_import(client, study, subjects=[PATIENT], samples=[TUMOUR, RNA]).status_code == 200

    body = run_import(client, study, subjects=[PATIENT], samples=[TUMOUR, RNA]).json()
    assert body["subjects"] == {"created": 0, "unchanged": 1, "different": 0}
    assert body["samples"] == {"created": 0, "unchanged": 2, "different": 0}
    assert names(client, study, "samples") == ["T-01", "T-01-RNA"]
    assert len(audit_actors(database)) == 3


def test_differences_are_reported_and_left_unchanged(client: TestClient) -> None:
    study = create_study(client)
    other_patient = {"name": "P-02", "subject_type": "patient"}
    normal = {"name": "N-01", "material_type": "blood"}
    run_import(client, study, subjects=[PATIENT, other_patient], samples=[TUMOUR, RNA, normal])

    response = run_import(
        client,
        study,
        subjects=[{**PATIENT, "species": "Mus musculus"}],
        samples=[
            {**TUMOUR, "subject": "P-02", "material_type": "blood"},
            {**RNA, "parent": "N-01"},
        ],
    )

    body = response.json()
    assert body["subjects"] == {"created": 0, "unchanged": 0, "different": 1}
    assert body["samples"] == {"created": 0, "unchanged": 0, "different": 2}
    assert {d["name"]: d["fields"] for d in body["differences"]} == {
        "P-01": {"species": {"recorded": "Homo sapiens", "import": "Mus musculus"}},
        "T-01": {
            "subject": {"recorded": "P-01", "import": "P-02"},
            "material_type": {"recorded": "tissue", "import": "blood"},
        },
        "T-01-RNA": {"parent": {"recorded": "T-01", "import": "N-01"}},
    }
    samples = by_name(client, study, "samples")
    assert (samples["T-01"]["subject_name"], samples["T-01"]["material_type"]) == (
        "P-01",
        "tissue",
    )
    assert samples["T-01-RNA"]["parent_sample_name"] == "T-01"


def test_records_are_matched_by_external_id_before_name(client: TestClient) -> None:
    study = create_study(client)
    run_import(client, study, subjects=[PATIENT])
    subject_id = by_name(client, study, "subjects")["P-01"]["id"]
    client.patch(f"{API}/subjects/{subject_id}", json={"name": "P-01 (corrected)"})

    body = run_import(client, study, subjects=[PATIENT], samples=[TUMOUR]).json()

    assert body["subjects"] == {"created": 0, "unchanged": 0, "different": 1}
    assert body["differences"][0]["fields"] == {
        "name": {"recorded": "P-01 (corrected)", "import": "P-01"}
    }
    assert by_name(client, study, "samples")["T-01"]["subject_name"] == "P-01 (corrected)"


def test_records_without_external_ids_are_matched_by_name(client: TestClient) -> None:
    study = create_study(client)
    run_import(client, study, subjects=[{"name": "P-01", "subject_type": "patient"}])

    body = run_import(client, study, subjects=[PATIENT]).json()
    assert body["subjects"] == {"created": 0, "unchanged": 0, "different": 1}
    assert body["differences"][0]["fields"] == {
        "external_id": {"recorded": None, "import": "case-1"},
        "species": {"recorded": None, "import": "Homo sapiens"},
    }

    other = create_study(client, "P1", "S2")
    run_import(client, other, subjects=[PATIENT])
    body = run_import(client, other, subjects=[{"name": "P-01", "subject_type": "patient"}]).json()
    assert body["subjects"] == {"created": 0, "unchanged": 1, "different": 0}


def test_ambiguous_matches_are_refused(client: TestClient) -> None:
    study = create_study(client)
    second = {"name": "P-02", "external_id": "case-2", "subject_type": "patient"}
    run_import(client, study, subjects=[PATIENT, second])

    cases = [
        (
            {"name": "P-02", "external_id": "case-1", "subject_type": "patient"},
            "its external ID 'case-1' belongs to subject 'P-01'",
        ),
        (
            {"name": "P-01", "external_id": "case-9", "subject_type": "patient"},
            "already used by a subject with the external ID 'case-1'",
        ),
    ]
    for subject, message in cases:
        response = run_import(client, study, subjects=[subject])
        assert response.status_code == 422
        assert message in response.json()["detail"]["problems"][0]

    renamed = {"name": "Renamed", "external_id": "case-1", "subject_type": "patient"}
    response = run_import(
        client, study, subjects=[{"name": "P-01", "subject_type": "patient"}, renamed]
    )
    assert response.status_code == 422
    assert response.json()["detail"]["problems"] == [
        "subject 'Renamed': matches the same existing subject as 'P-01'"
    ]


def test_problems_are_all_reported_and_nothing_is_saved(client: TestClient) -> None:
    study = create_study(client)
    response = run_import(
        client,
        study,
        subjects=[PATIENT, PATIENT],
        samples=[
            {**TUMOUR, "subject": "Nobody"},
            {"name": "X", "external_id": "sample-1", "parent": "Missing", "material_type": "RNA"},
            {"name": "A", "parent": "B", "material_type": "RNA"},
            {"name": "B", "parent": "A", "material_type": "RNA"},
            {"name": "C", "parent": "A", "material_type": "RNA"},
            {"name": "D", "parent": "D", "material_type": "RNA"},
        ],
    )

    assert response.status_code == 422
    detail = response.json()["detail"]
    assert detail["message"] == "Nothing was imported, because of these problems."
    loop = "it would be derived from itself, directly or through other samples"
    assert detail["problems"] == [
        "subjects: more than one has the name 'P-01'",
        "subjects: more than one has the external ID 'case-1'",
        "samples: more than one has the external ID 'sample-1'",
        "sample 'T-01': there's no subject called 'Nobody' in the study or the import",
        "sample 'X': there's no sample called 'Missing' in the study or the import",
        f"sample 'A': {loop}",
        f"sample 'B': {loop}",
        f"sample 'D': {loop}",
    ]
    assert names(client, study, "subjects") == []
    assert names(client, study, "samples") == []


def test_an_import_is_limited_in_size(client: TestClient) -> None:
    study = create_study(client)
    subjects = [{"name": f"P-{n}", "subject_type": "patient"} for n in range(5001)]
    response = run_import(client, study, dry_run=True, subjects=subjects)
    assert response.status_code == 422
    assert "at most 5000 records" in str(response.json())


def test_dry_run_must_be_chosen_and_the_study_must_exist(client: TestClient) -> None:
    study = create_study(client)
    assert client.post(f"{study}/import", json={"source": "test"}).status_code == 422
    unknown = f"{API}/projects/P1/studies/NOPE/import"
    assert client.post(unknown, json={"source": "test", "dry_run": True}).status_code == 404


def linked_samples(client: TestClient, study_url: str) -> list[tuple[str, str | None]]:
    assay_id = client.get(f"{study_url}/assays").json()["items"][0]["id"]
    response = client.get(f"{API}/assays/{assay_id}/samples")
    return [(s["sample_name"], s["label"]) for s in response.json()["items"]]


def test_import_creates_assays_and_links_them_to_samples(
    client: TestClient, database: Engine
) -> None:
    study = create_study(client)
    response = run_import(client, study, subjects=[PATIENT], samples=[TUMOUR, RNA], assays=[ASSAY])

    assert response.status_code == 200, response.json()
    body = response.json()
    assert body["assays"] == {"created": 1, "unchanged": 0, "different": 0}
    assert body["assay_samples"] == {"created": 1, "unchanged": 0, "different": 0}
    assay = client.get(f"{study}/assays").json()["items"][0]
    assert (assay["name"], assay["created_by"], assay["sample_count"]) == (
        "Run-1",
        BY_SITE_ADMIN,
        1,
    )
    assert linked_samples(client, study) == [("T-01-RNA", "lane 1")]
    with database.connect() as conn:
        actions = conn.execute(
            text(
                "SELECT action, actor FROM audit_event"
                " WHERE entity_type = 'assay' ORDER BY occurred_at, id"
            )
        ).all()
    assert [tuple(row) for row in actions] == [
        ("create", BY_SITE_ADMIN),
        ("add_sample", BY_SITE_ADMIN),
    ]


def test_assay_links_are_added_but_never_changed(client: TestClient) -> None:
    study = create_study(client)
    run_import(client, study, subjects=[PATIENT], samples=[TUMOUR, RNA], assays=[ASSAY])

    body = run_import(client, study, assays=[ASSAY]).json()
    assert body["assays"] == {"created": 0, "unchanged": 1, "different": 0}
    assert body["assay_samples"] == {"created": 0, "unchanged": 1, "different": 0}

    again = {
        **ASSAY,
        "platform": "NovaSeq 6000",
        "samples": [
            {"sample": "T-01-RNA", "label": "lane 2"},
            {"sample": "T-01"},
            {"sample": "N-01"},
        ],
    }
    body = run_import(
        client, study, samples=[{"name": "N-01", "material_type": "blood"}], assays=[again]
    ).json()
    assert body["assays"] == {"created": 0, "unchanged": 0, "different": 1}
    assert body["assay_samples"] == {"created": 2, "unchanged": 0, "different": 1}
    assert [(d["kind"], d["name"], d["fields"]) for d in body["differences"]] == [
        ("assay", "Run-1", {"platform": {"recorded": None, "import": "NovaSeq 6000"}}),
        ("assay sample", "Run-1 / T-01-RNA", {"label": {"recorded": "lane 1", "import": "lane 2"}}),
    ]
    assert linked_samples(client, study) == [
        ("N-01", None),
        ("T-01", None),
        ("T-01-RNA", "lane 1"),
    ]

    body = run_import(client, study, assays=[{**ASSAY, "samples": [{"sample": "T-01-RNA"}]}]).json()
    assert body["assay_samples"] == {"created": 0, "unchanged": 1, "different": 0}


def test_assay_problems_are_reported(client: TestClient) -> None:
    study = create_study(client)
    links = [{"sample": "T-01"}, {"sample": "T-01"}, {"sample": "Nowhere"}]
    response = run_import(
        client,
        study,
        samples=[{"name": "T-01", "material_type": "tissue"}],
        assays=[{**ASSAY, "samples": links}, {**ASSAY, "samples": []}],
    )

    assert response.status_code == 422
    assert response.json()["detail"]["problems"] == [
        "assays: more than one has the name 'Run-1'",
        "assays: more than one has the external ID 'run-1'",
        "assay 'Run-1': lists sample 'T-01' more than once",
        "assay 'Run-1': there's no sample called 'Nowhere' in the study or the import",
    ]
    assert client.get(f"{study}/assays").json()["total"] == 0


def test_import_creates_data_files_with_their_samples_and_inputs(
    client: TestClient, database: Engine
) -> None:
    study = create_study(client)
    response = run_import(
        client,
        study,
        subjects=[PATIENT],
        samples=[TUMOUR, RNA],
        assays=[ASSAY],
        data_files=[COUNTS, READS],
    )

    assert response.status_code == 200, response.json()
    body = response.json()
    assert body["data_files"] == {"created": 2, "unchanged": 0, "different": 0}
    assert body["data_file_samples"] == {"created": 2, "unchanged": 0, "different": 0}
    assert body["data_file_inputs"] == {"created": 1, "unchanged": 0, "different": 0}

    files = by_name(client, study, "data-files")
    assert files["reads.fastq"]["assay_name"] == "Run-1"
    assert (files["counts.tsv"]["sample_count"], files["counts.tsv"]["created_by"]) == (
        1,
        BY_SITE_ADMIN,
    )
    inputs = client.get(f"{API}/data-files/{files['counts.tsv']['id']}/inputs").json()
    assert [f["name"] for f in inputs] == ["reads.fastq"]
    with database.connect() as conn:
        actions = conn.execute(
            text("SELECT action FROM audit_event WHERE entity_type = 'data_file'")
        ).scalars()
        assert sorted(actions) == ["add_input", "add_sample", "add_sample", "create", "create"]


def test_data_file_links_are_added_but_never_changed(client: TestClient) -> None:
    study = create_study(client)
    run_import(
        client,
        study,
        subjects=[PATIENT],
        samples=[TUMOUR, RNA],
        assays=[ASSAY],
        data_files=[READS, COUNTS],
    )

    body = run_import(client, study, data_files=[READS, COUNTS]).json()
    assert body["data_files"] == {"created": 0, "unchanged": 2, "different": 0}
    assert body["data_file_samples"] == {"created": 0, "unchanged": 2, "different": 0}
    assert body["data_file_inputs"] == {"created": 0, "unchanged": 1, "different": 0}

    changed = {
        **COUNTS,
        "format": "CSV",
        "assay": "Run-1",
        "samples": [{"sample": "T-01-RNA", "label": "column 2"}, {"sample": "T-01"}],
    }
    report = {
        "name": "report.html",
        "uri": "https://example.org/report.html",
        "level": "analysis",
        "format": "HTML",
        "inputs": ["https://example.org/counts.tsv"],
    }
    body = run_import(client, study, data_files=[changed, report]).json()

    assert body["data_files"] == {"created": 1, "unchanged": 0, "different": 1}
    assert body["data_file_samples"] == {"created": 1, "unchanged": 0, "different": 1}
    assert body["data_file_inputs"] == {"created": 1, "unchanged": 1, "different": 0}
    counts_uri = "https://example.org/counts.tsv"
    assert [(d["kind"], d["name"], d["fields"]) for d in body["differences"]] == [
        (
            "data file",
            counts_uri,
            {
                "format": {"recorded": "TSV", "import": "CSV"},
                "assay": {"recorded": None, "import": "Run-1"},
            },
        ),
        (
            "data file sample",
            f"{counts_uri} / T-01-RNA",
            {"label": {"recorded": "column 1", "import": "column 2"}},
        ),
    ]
    files = by_name(client, study, "data-files")
    assert (files["counts.tsv"]["format"], files["counts.tsv"]["assay_name"]) == ("TSV", None)
    assert files["counts.tsv"]["sample_count"] == 2


def test_data_files_are_matched_by_external_id_then_location(client: TestClient) -> None:
    study = create_study(client)
    run_import(client, study, data_files=[FILE_A, FILE_B])

    moved = {**FILE_A, "uri": "s3://bucket/a.bam"}
    body = run_import(client, study, data_files=[moved]).json()
    assert body["data_files"] == {"created": 0, "unchanged": 0, "different": 1}
    assert body["differences"][0]["fields"] == {
        "uri": {"recorded": "https://example.org/a.bam", "import": "s3://bucket/a.bam"}
    }

    cases: list[tuple[list[dict[str, Any]], str]] = [
        (
            [{**FILE_B, "external_id": "file-a"}],
            "data file 'https://example.org/b.bam': its external ID 'file-a' belongs to the file "
            "at 'https://example.org/a.bam', but its location belongs to a different file",
        ),
        (
            [{**FILE_A, "external_id": "file-z"}],
            "data file 'https://example.org/a.bam': that location is already used by a file "
            "with the external ID 'file-a'",
        ),
        (
            [{**FILE_A, "external_id": None}, {**FILE_A, "uri": "s3://bucket/a.bam"}],
            "data file 's3://bucket/a.bam': matches the same existing file as "
            "'https://example.org/a.bam'",
        ),
    ]
    for data_files, problem in cases:
        response = run_import(client, study, data_files=data_files)
        assert response.status_code == 422
        assert response.json()["detail"]["problems"] == [problem]


def test_data_file_problems_are_reported(client: TestClient) -> None:
    study = create_study(client)
    a, b = FILE_A["uri"], FILE_B["uri"]
    response = run_import(
        client,
        study,
        samples=[{"name": "T-01", "material_type": "tissue"}],
        data_files=[
            {
                **FILE_A,
                "assay": "Nothing",
                "samples": [{"sample": "T-01"}, {"sample": "T-01"}, {"sample": "Nobody"}],
                "inputs": [b, b, "https://example.org/missing"],
            },
            {**FILE_B, "inputs": [a]},
            {**FILE_A, "name": "copy.bam"},
        ],
    )

    assert response.status_code == 422
    where = f"data file {a!r}"
    loop = "it would be derived from itself, directly or through other files"
    assert response.json()["detail"]["problems"] == [
        f"data files: more than one has the location {a!r}",
        "data files: more than one has the external ID 'file-a'",
        f"{where}: there's no assay called 'Nothing' in the study or the import",
        f"{where}: lists sample 'T-01' more than once",
        f"{where}: there's no sample called 'Nobody' in the study or the import",
        f"{where}: lists the input {b!r} more than once",
        f"{where}: there's no data file at 'https://example.org/missing' "
        "in the study or the import",
        f"{where}: {loop}",
        f"data file {b!r}: {loop}",
    ]
    assert client.get(f"{study}/data-files").json()["total"] == 0


def test_an_import_cannot_make_an_existing_file_derive_from_itself(client: TestClient) -> None:
    study = create_study(client)
    a, b = FILE_A["uri"], FILE_B["uri"]
    run_import(client, study, data_files=[FILE_A, {**FILE_B, "inputs": [a]}])

    response = run_import(client, study, data_files=[{**FILE_A, "inputs": [b]}])
    assert response.status_code == 422
    assert response.json()["detail"]["problems"] == [
        f"data file {a!r}: it would be derived from itself, directly or through other files"
    ]
