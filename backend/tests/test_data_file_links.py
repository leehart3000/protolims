"""Tests for a data file's samples and inputs."""

from fastapi.testclient import TestClient
from sqlalchemy import Engine, text

API = "/api/v1"
UNKNOWN = "00000000-0000-7000-8000-000000000000"


def create_study(client: TestClient, project: str = "P1", study: str = "S1") -> str:
    """Create a study (and its project, if needed); return the study's URL."""
    client.post(f"{API}/projects", json={"code": project, "name": f"Project {project}"})
    response = client.post(
        f"{API}/projects/{project}/studies", json={"code": study, "title": f"Study {study}"}
    )
    assert response.status_code == 201
    return f"{API}/projects/{project}/studies/{study}"


def create_file(client: TestClient, study_url: str, name: str, level: str = "raw") -> str:
    response = client.post(
        f"{study_url}/data-files",
        json={"name": name, "level": level, "format": "TSV", "uri": f"https://example.org/{name}"},
    )
    assert response.status_code == 201, response.json()
    file_id: str = response.json()["id"]
    return file_id


def create_sample(client: TestClient, study_url: str, name: str, **fields: object) -> str:
    response = client.post(
        f"{study_url}/samples", json={"name": name, "material_type": "RNA", **fields}
    )
    assert response.status_code == 201, response.json()
    sample_id: str = response.json()["id"]
    return sample_id


def linked(client: TestClient, file_id: str, **params: str | int) -> list[tuple[str, str | None]]:
    response = client.get(f"{API}/data-files/{file_id}/samples", params=params)
    assert response.status_code == 200, response.json()
    return [(s["sample_name"], s["label"]) for s in response.json()["items"]]


def audit(database: Engine, action: str) -> list[object]:
    with database.connect() as conn:
        return list(
            conn.execute(
                text("SELECT changes FROM audit_event WHERE action = :a ORDER BY occurred_at, id"),
                {"a": action},
            ).scalars()
        )


def test_link_samples_to_a_file(client: TestClient, database: Engine) -> None:
    study = create_study(client)
    file_id = create_file(client, study, "counts.tsv")
    first = create_sample(client, study, "S1")
    second = create_sample(client, study, "S2")
    url = f"{API}/data-files/{file_id}/samples"

    response = client.put(f"{url}/{second}", json={"label": "column 2"})
    assert response.status_code == 201
    assert (response.json()["sample_name"], response.json()["label"]) == ("S2", "column 2")
    assert client.put(f"{url}/{first}", json={}).status_code == 201
    assert client.put(f"{url}/{first}", json={}).status_code == 200
    assert client.put(f"{url}/{first}", json={"label": "column 1"}).status_code == 200

    assert linked(client, file_id) == [("S1", "column 1"), ("S2", "column 2")]
    assert client.get(f"{API}/data-files/{file_id}").json()["sample_count"] == 2
    assert len(audit(database, "add_sample")) == 2
    which = {"sample_id": first, "sample": "S1"}
    assert audit(database, "update_sample") == [
        {"before": {**which, "label": None}, "after": {**which, "label": "column 1"}}
    ]


def test_list_file_samples_sorts_searches_and_pages(client: TestClient) -> None:
    study = create_study(client)
    file_id = create_file(client, study, "counts.tsv")
    for name, label, external_id in [("A", "c3", "X-99"), ("B", "c1", None), ("C", None, None)]:
        sample_id = create_sample(client, study, name, external_id=external_id)
        client.put(f"{API}/data-files/{file_id}/samples/{sample_id}", json={"label": label})

    assert linked(client, file_id, sort="-name") == [("C", None), ("B", "c1"), ("A", "c3")]
    assert linked(client, file_id, sort="label") == [("B", "c1"), ("A", "c3"), ("C", None)]
    assert linked(client, file_id, sort="-label") == [("A", "c3"), ("B", "c1"), ("C", None)]
    assert linked(client, file_id, q="x-99") == [("A", "c3")]

    body = client.get(
        f"{API}/data-files/{file_id}/samples", params={"limit": 1, "offset": 1}
    ).json()
    assert [s["sample_name"] for s in body["items"]] == ["B"]
    assert body["total"] == 3


def test_linked_samples_must_be_in_the_same_study(client: TestClient) -> None:
    first = create_study(client, "P1", "S1")
    second = create_study(client, "P1", "S2")
    file_id = create_file(client, first, "counts.tsv")
    other_sample = create_sample(client, second, "Other")

    for sample_id in [other_sample, UNKNOWN]:
        response = client.put(f"{API}/data-files/{file_id}/samples/{sample_id}", json={})
        assert response.status_code == 422
        assert "same study" in response.json()["detail"]


def test_unlink_a_sample(client: TestClient, database: Engine) -> None:
    study = create_study(client)
    file_id = create_file(client, study, "counts.tsv")
    sample_id = create_sample(client, study, "S1")
    url = f"{API}/data-files/{file_id}/samples/{sample_id}"
    client.put(url, json={"label": "c1"})

    assert client.delete(url).status_code == 204
    assert linked(client, file_id) == []
    assert client.delete(url).status_code == 404
    assert audit(database, "remove_sample") == [
        {"before": {"sample_id": sample_id, "sample": "S1", "label": "c1"}}
    ]


def test_list_a_samples_data_files(client: TestClient) -> None:
    study = create_study(client)
    measured = create_sample(client, study, "S1")
    unmeasured = create_sample(client, study, "S2")
    reads = create_file(client, study, "reads.fastq")
    counts = create_file(client, study, "counts.tsv", level="processed")
    client.put(f"{API}/data-files/{reads}/samples/{measured}", json={})
    client.put(f"{API}/data-files/{counts}/samples/{measured}", json={"label": "c1"})

    response = client.get(f"{API}/samples/{measured}/data-files")
    assert response.status_code == 200
    assert [(f["name"], f["level"], f["label"]) for f in response.json()] == [
        ("counts.tsv", "processed", "c1"),
        ("reads.fastq", "raw", None),
    ]
    assert client.get(f"{API}/samples/{unmeasured}/data-files").json() == []
    assert client.get(f"{API}/samples/{UNKNOWN}/data-files").status_code == 404


def test_unknown_file_returns_404_for_its_links(client: TestClient) -> None:
    study = create_study(client)
    sample_id = create_sample(client, study, "S1")
    other_file = create_file(client, study, "f.tsv")
    unknown = f"{API}/data-files/{UNKNOWN}"

    assert client.put(f"{unknown}/samples/{sample_id}", json={}).status_code == 404
    assert client.get(f"{unknown}/samples").status_code == 404
    assert client.delete(f"{unknown}/samples/{sample_id}").status_code == 404
    assert client.put(f"{unknown}/inputs/{other_file}").status_code == 404
    assert client.get(f"{unknown}/inputs").status_code == 404
    assert client.get(f"{unknown}/outputs").status_code == 404
    assert client.delete(f"{unknown}/inputs/{other_file}").status_code == 404


def test_record_which_files_a_file_was_derived_from(client: TestClient, database: Engine) -> None:
    study = create_study(client)
    reads_1 = create_file(client, study, "reads_1.fastq")
    reads_2 = create_file(client, study, "reads_2.fastq")
    bam = create_file(client, study, "aligned.bam", level="processed")

    response = client.put(f"{API}/data-files/{bam}/inputs/{reads_2}")
    assert response.status_code == 201
    assert response.json()["name"] == "reads_2.fastq"
    assert client.put(f"{API}/data-files/{bam}/inputs/{reads_1}").status_code == 201
    assert client.put(f"{API}/data-files/{bam}/inputs/{reads_1}").status_code == 200

    inputs = client.get(f"{API}/data-files/{bam}/inputs").json()
    assert [f["name"] for f in inputs] == ["reads_1.fastq", "reads_2.fastq"]
    outputs = client.get(f"{API}/data-files/{reads_1}/outputs").json()
    assert [f["name"] for f in outputs] == ["aligned.bam"]
    assert client.get(f"{API}/data-files/{bam}/outputs").json() == []
    assert len(audit(database, "add_input")) == 2


def test_inputs_must_be_in_the_same_study(client: TestClient) -> None:
    first = create_study(client, "P1", "S1")
    second = create_study(client, "P1", "S2")
    file_id = create_file(client, first, "f.tsv")
    other_file = create_file(client, second, "g.tsv")

    for input_id in [other_file, UNKNOWN]:
        response = client.put(f"{API}/data-files/{file_id}/inputs/{input_id}")
        assert response.status_code == 422
        assert "same study" in response.json()["detail"]


def test_a_file_cannot_be_derived_from_itself_or_its_own_outputs(client: TestClient) -> None:
    study = create_study(client)
    reads = create_file(client, study, "reads.fastq")
    bam = create_file(client, study, "aligned.bam", level="processed")
    counts = create_file(client, study, "counts.tsv", level="processed")
    client.put(f"{API}/data-files/{bam}/inputs/{reads}")
    client.put(f"{API}/data-files/{counts}/inputs/{bam}")

    for file_id, input_id in [(reads, reads), (reads, bam), (reads, counts), (bam, counts)]:
        response = client.put(f"{API}/data-files/{file_id}/inputs/{input_id}")
        assert response.status_code == 422, (file_id, input_id)
        assert "derived" in response.json()["detail"]

    assert client.put(f"{API}/data-files/{counts}/inputs/{reads}").status_code == 201


def test_remove_an_input(client: TestClient, database: Engine) -> None:
    study = create_study(client)
    reads = create_file(client, study, "reads.fastq")
    bam = create_file(client, study, "aligned.bam", level="processed")
    url = f"{API}/data-files/{bam}/inputs/{reads}"
    client.put(url)

    assert client.delete(url).status_code == 204
    assert client.get(f"{API}/data-files/{bam}/inputs").json() == []
    assert client.delete(url).status_code == 404
    assert audit(database, "remove_input") == [
        {"before": {"input_id": reads, "input": "reads.fastq"}}
    ]
