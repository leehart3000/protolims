"""Tests for the data file endpoints."""

from datetime import datetime

from fastapi.testclient import TestClient
from sqlalchemy import Engine, text

API = "/api/v1"
UNKNOWN = "00000000-0000-7000-8000-000000000000"
SHA = "a" * 64


def create_study(client: TestClient, project: str = "P1", study: str = "S1") -> str:
    """Create a study (and its project, if needed); return the study's URL."""
    client.post(f"{API}/projects", json={"code": project, "name": f"Project {project}"})
    response = client.post(
        f"{API}/projects/{project}/studies", json={"code": study, "title": f"Study {study}"}
    )
    assert response.status_code == 201
    return f"{API}/projects/{project}/studies/{study}"


def create_assay(client: TestClient, study_url: str, name: str = "Run-01") -> str:
    response = client.post(
        f"{study_url}/assays",
        json={"name": name, "measurement_type": "m", "technology_type": "t"},
    )
    assert response.status_code == 201
    assay_id: str = response.json()["id"]
    return assay_id


def create_file(
    client: TestClient, study_url: str, name: str, uri: str | None = None, **fields: object
) -> str:
    response = client.post(
        f"{study_url}/data-files",
        json={
            "name": name,
            "level": "raw",
            "format": "FASTQ",
            "uri": uri or f"https://example.org/{name}",
            **fields,
        },
    )
    assert response.status_code == 201, response.json()
    file_id: str = response.json()["id"]
    return file_id


def list_names(client: TestClient, study_url: str, **params: str | int) -> list[str]:
    response = client.get(f"{study_url}/data-files", params=params)
    assert response.status_code == 200, response.json()
    return [f["name"] for f in response.json()["items"]]


def test_create_and_get_a_data_file(client: TestClient) -> None:
    study = create_study(client)
    assay_id = create_assay(client, study)
    file_id = create_file(
        client,
        study,
        "reads_1.fastq.gz",
        uri="s3://protolims-data/S1/reads_1.fastq.gz",
        external_id="GDC-FILE-01",
        assay_id=assay_id,
        size_bytes=123456,
        sha256=SHA,
        summary={"reads": 1000},
    )
    response = client.get(f"{API}/data-files/{file_id}")
    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "reads_1.fastq.gz"
    assert body["uri"] == "s3://protolims-data/S1/reads_1.fastq.gz"
    assert (body["level"], body["format"]) == ("raw", "FASTQ")
    assert (body["size_bytes"], body["sha256"]) == (123456, SHA)
    assert body["summary"] == {"reads": 1000}
    assert (body["assay_id"], body["assay_name"]) == (assay_id, "Run-01")
    assert body["sample_count"] == 0
    assert (body["project_code"], body["study_code"]) == ("P1", "S1")


def test_invalid_details_are_rejected(client: TestClient) -> None:
    study = create_study(client)
    valid = {"name": "f", "level": "raw", "format": "BAM", "uri": "https://example.org/f"}
    for fields in [
        {**valid, "uri": "http://example.org/f"},
        {**valid, "level": "final"},
        {**valid, "format": ""},
        {**valid, "size_bytes": -1},
        {**valid, "sha256": "A" * 64},
        {**valid, "sha256": "abc"},
        {**valid, "name": "has/slash"},
        {**valid, "colour": "blue"},
    ]:
        response = client.post(f"{study}/data-files", json=fields)
        assert response.status_code == 422, fields


def test_uris_are_unique_within_a_study_only_and_names_can_repeat(client: TestClient) -> None:
    first = create_study(client, "P1", "S1")
    second = create_study(client, "P1", "S2")
    create_file(client, first, "counts.tsv", uri="https://example.org/a/counts.tsv")
    create_file(client, first, "counts.tsv", uri="https://example.org/b/counts.tsv")
    create_file(client, second, "counts.tsv", uri="https://example.org/a/counts.tsv")

    response = client.post(
        f"{first}/data-files",
        json={
            "name": "other.tsv",
            "level": "raw",
            "format": "TSV",
            "uri": "https://example.org/a/counts.tsv",
        },
    )
    assert response.status_code == 409


def test_assay_must_be_in_the_same_study(client: TestClient) -> None:
    first = create_study(client, "P1", "S1")
    second = create_study(client, "P1", "S2")
    other_assay = create_assay(client, second)
    for assay_id in [other_assay, UNKNOWN]:
        response = client.post(
            f"{first}/data-files",
            json={
                "name": "f",
                "level": "raw",
                "format": "BAM",
                "uri": "https://example.org/f",
                "assay_id": assay_id,
            },
        )
        assert response.status_code == 422
        assert "assay" in response.json()["detail"]


def test_unknown_study_returns_404(client: TestClient) -> None:
    create_study(client)
    unknown = f"{API}/projects/P1/studies/NOPE/data-files"
    response = client.post(
        unknown,
        json={"name": "f", "level": "raw", "format": "BAM", "uri": "https://example.org/f"},
    )
    assert response.status_code == 404
    assert client.get(unknown).status_code == 404


def test_unknown_or_invalid_data_file_id(client: TestClient) -> None:
    assert client.get(f"{API}/data-files/{UNKNOWN}").status_code == 404
    assert client.get(f"{API}/data-files/not-an-id").status_code == 422


def test_list_data_files_only_returns_that_studys_files(client: TestClient) -> None:
    first = create_study(client, "P1", "S1")
    second = create_study(client, "P1", "S2")
    create_file(client, first, "b.bam")
    create_file(client, first, "a.bam")
    create_file(client, second, "c.bam")
    body = client.get(f"{first}/data-files").json()
    assert [f["name"] for f in body["items"]] == ["a.bam", "b.bam"]
    assert body["total"] == 2


def test_list_data_files_filters_by_assay_and_level(client: TestClient) -> None:
    study = create_study(client)
    assay_id = create_assay(client, study)
    create_file(client, study, "raw.fastq", assay_id=assay_id)
    create_file(client, study, "counts.tsv", level="processed", format="TSV", assay_id=assay_id)
    create_file(client, study, "other.fastq")

    assert list_names(client, study, assay=assay_id) == ["counts.tsv", "raw.fastq"]
    assert list_names(client, study, level="processed") == ["counts.tsv"]
    assert list_names(client, study, assay=assay_id, level="raw") == ["raw.fastq"]
    assert client.get(f"{study}/data-files", params={"level": "final"}).status_code == 422


def test_list_data_files_sorts_by_a_chosen_column(client: TestClient) -> None:
    study = create_study(client)
    create_file(client, study, "A", level="processed", format="TSV", size_bytes=200)
    create_file(client, study, "B", level="analysis", format="BAM")
    create_file(client, study, "C", level="raw", format="CSV", size_bytes=100)

    assert list_names(client, study) == ["A", "B", "C"]
    assert list_names(client, study, sort="-name") == ["C", "B", "A"]
    assert list_names(client, study, sort="level") == ["B", "A", "C"]
    assert list_names(client, study, sort="format") == ["B", "C", "A"]
    assert list_names(client, study, sort="size_bytes") == ["C", "A", "B"]
    assert list_names(client, study, sort="-size_bytes") == ["A", "C", "B"]
    assert list_names(client, study, sort="-created_at") == ["C", "B", "A"]
    assert client.get(f"{study}/data-files", params={"sort": "colour"}).status_code == 422


def test_list_data_files_searches_names_external_ids_and_uris(client: TestClient) -> None:
    study = create_study(client)
    create_file(client, study, "tumour.bam")
    create_file(client, study, "normal.bam", external_id="TUM-99")
    create_file(client, study, "counts.tsv", uri="s3://bucket/tumour-folder/counts.tsv")
    create_file(client, study, "100%_done.txt")

    assert list_names(client, study, q="tum") == ["counts.tsv", "normal.bam", "tumour.bam"]
    assert list_names(client, study, q="%") == ["100%_done.txt"]
    assert list_names(client, study, q="nothing") == []


def test_list_data_files_pages_through_results_with_a_total(client: TestClient) -> None:
    study = create_study(client)
    for name in ["A", "B", "C", "D", "E"]:
        create_file(client, study, name)

    body = client.get(f"{study}/data-files", params={"limit": 2, "offset": 2}).json()
    assert [f["name"] for f in body["items"]] == ["C", "D"]
    assert body["total"] == 5


def test_create_data_file_records_audit_event(client: TestClient, database: Engine) -> None:
    study = create_study(client)
    create_file(client, study, "f.bam")
    with database.connect() as conn:
        rows = conn.execute(
            text("SELECT entity_type FROM audit_event ORDER BY occurred_at, id")
        ).all()
    assert [row[0] for row in rows] == ["project", "study", "data_file"]


def test_update_data_file_changes_only_the_fields_sent(
    client: TestClient, database: Engine
) -> None:
    study = create_study(client)
    assay_id = create_assay(client, study)
    file_id = create_file(client, study, "f.bam", format="BAM")

    response = client.patch(
        f"{API}/data-files/{file_id}", json={"format": "CRAM", "assay_id": assay_id}
    )
    assert response.status_code == 200
    body = response.json()
    assert (body["name"], body["format"], body["assay_name"]) == ("f.bam", "CRAM", "Run-01")
    assert datetime.fromisoformat(body["updated_at"]) > datetime.fromisoformat(body["created_at"])

    with database.connect() as conn:
        changes = conn.execute(
            text("SELECT changes FROM audit_event WHERE action = 'update'")
        ).scalar_one()
    assert changes == {
        "before": {"format": "BAM", "assay_id": None},
        "after": {"format": "CRAM", "assay_id": assay_id},
    }


def test_update_data_file_with_no_real_changes_records_nothing(
    client: TestClient, database: Engine
) -> None:
    study = create_study(client)
    file_id = create_file(client, study, "f.bam")

    assert client.patch(f"{API}/data-files/{file_id}", json={"name": "f.bam"}).status_code == 200

    with database.connect() as conn:
        updates = conn.execute(
            text("SELECT count(*) FROM audit_event WHERE action = 'update'")
        ).scalar_one()
    assert updates == 0


def test_update_data_file_can_clear_optional_fields_but_not_required_ones(
    client: TestClient,
) -> None:
    study = create_study(client)
    assay_id = create_assay(client, study)
    file_id = create_file(
        client,
        study,
        "f.bam",
        external_id="X-1",
        assay_id=assay_id,
        size_bytes=10,
        sha256=SHA,
    )

    response = client.patch(
        f"{API}/data-files/{file_id}",
        json={"external_id": None, "assay_id": None, "size_bytes": None, "sha256": None},
    )
    assert response.status_code == 200
    body = response.json()
    assert (body["external_id"], body["assay_name"], body["size_bytes"], body["sha256"]) == (
        None,
        None,
        None,
        None,
    )

    for fields in [
        {"name": None},
        {"level": None},
        {"format": None},
        {"uri": None},
        {"summary": None},
        {"uri": "file:///etc/passwd"},
        {"study_id": UNKNOWN},
    ]:
        assert client.patch(f"{API}/data-files/{file_id}", json=fields).status_code == 422, fields


def test_update_data_file_rejects_a_uri_used_in_the_study(client: TestClient) -> None:
    study = create_study(client)
    create_file(client, study, "a.bam", uri="https://example.org/a.bam")
    second = create_file(client, study, "b.bam", uri="https://example.org/b.bam")

    response = client.patch(f"{API}/data-files/{second}", json={"uri": "https://example.org/a.bam"})
    assert response.status_code == 409


def test_update_data_file_checks_the_assay_is_in_the_same_study(client: TestClient) -> None:
    first = create_study(client, "P1", "S1")
    second = create_study(client, "P1", "S2")
    file_id = create_file(client, first, "f.bam")
    other_assay = create_assay(client, second)

    response = client.patch(f"{API}/data-files/{file_id}", json={"assay_id": other_assay})
    assert response.status_code == 422


def test_update_unknown_data_file_returns_404(client: TestClient) -> None:
    unknown = f"{API}/data-files/{UNKNOWN}"
    assert client.patch(unknown, json={"format": "BAM"}).status_code == 404
