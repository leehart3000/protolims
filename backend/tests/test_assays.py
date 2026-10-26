"""Tests for the assay endpoints."""

from datetime import UTC, datetime

from fastapi.testclient import TestClient
from sqlalchemy import Engine, text

API = "/api/v1"


def create_study(client: TestClient, project: str = "P1", study: str = "S1") -> str:
    """Create a study (and its project, if needed); return the study's URL."""
    client.post(f"{API}/projects", json={"code": project, "name": f"Project {project}"})
    response = client.post(
        f"{API}/projects/{project}/studies", json={"code": study, "title": f"Study {study}"}
    )
    assert response.status_code == 201
    return f"{API}/projects/{project}/studies/{study}"


def create_assay(client: TestClient, study_url: str, name: str, **fields: object) -> str:
    response = client.post(
        f"{study_url}/assays",
        json={
            "name": name,
            "measurement_type": "transcription profiling",
            "technology_type": "nucleotide sequencing",
            **fields,
        },
    )
    assert response.status_code == 201, response.json()
    assay_id: str = response.json()["id"]
    return assay_id


def list_names(client: TestClient, study_url: str, **params: str | int) -> list[str]:
    response = client.get(f"{study_url}/assays", params=params)
    assert response.status_code == 200, response.json()
    return [a["name"] for a in response.json()["items"]]


def test_create_and_get_an_assay(client: TestClient) -> None:
    study = create_study(client)
    assay_id = create_assay(
        client,
        study,
        "RNA-seq batch 1",
        external_id="GDC-RG-01",
        platform="Illumina HiSeq 2000",
        performed_at="2026-10-01T09:00:00Z",
        parameters={"read length": 50},
    )
    response = client.get(f"{API}/assays/{assay_id}")
    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "RNA-seq batch 1"
    assert body["external_id"] == "GDC-RG-01"
    assert body["measurement_type"] == "transcription profiling"
    assert body["technology_type"] == "nucleotide sequencing"
    assert body["platform"] == "Illumina HiSeq 2000"
    assert datetime.fromisoformat(body["performed_at"]) == datetime(2026, 10, 1, 9, tzinfo=UTC)
    assert body["parameters"] == {"read length": 50}
    assert (body["project_code"], body["study_code"]) == ("P1", "S1")


def test_invalid_details_are_rejected(client: TestClient) -> None:
    study = create_study(client)
    valid = {"name": "A1", "measurement_type": "m", "technology_type": "t"}
    for fields in [
        {**valid, "name": "has/slash"},
        {**valid, "measurement_type": ""},
        {"name": "A1", "measurement_type": "m"},
        {**valid, "performed_at": "2026-10-01T09:00:00"},
        {**valid, "colour": "blue"},
    ]:
        response = client.post(f"{study}/assays", json=fields)
        assert response.status_code == 422, fields


def test_names_are_unique_within_a_study_only(client: TestClient) -> None:
    first = create_study(client, "P1", "S1")
    create_assay(client, first, "A1")
    create_assay(client, create_study(client, "P1", "S2"), "A1")
    response = client.post(
        f"{first}/assays",
        json={"name": "A1", "measurement_type": "m", "technology_type": "t"},
    )
    assert response.status_code == 409


def test_unknown_study_returns_404(client: TestClient) -> None:
    create_study(client)
    unknown = f"{API}/projects/P1/studies/NOPE/assays"
    response = client.post(
        unknown, json={"name": "A1", "measurement_type": "m", "technology_type": "t"}
    )
    assert response.status_code == 404
    assert client.get(unknown).status_code == 404


def test_unknown_or_invalid_assay_id(client: TestClient) -> None:
    assert client.get(f"{API}/assays/00000000-0000-7000-8000-000000000000").status_code == 404
    assert client.get(f"{API}/assays/not-an-id").status_code == 422


def test_list_assays_only_returns_that_studys_assays(client: TestClient) -> None:
    first = create_study(client, "P1", "S1")
    second = create_study(client, "P1", "S2")
    create_assay(client, first, "B")
    create_assay(client, first, "A")
    create_assay(client, second, "C")
    body = client.get(f"{first}/assays").json()
    assert [a["name"] for a in body["items"]] == ["A", "B"]
    assert body["total"] == 2


def test_list_assays_sorts_by_a_chosen_column(client: TestClient) -> None:
    study = create_study(client)
    create_assay(
        client,
        study,
        "A",
        measurement_type="m2",
        technology_type="t1",
        platform="P2",
        performed_at="2026-01-02T00:00:00Z",
    )
    create_assay(
        client,
        study,
        "B",
        measurement_type="m1",
        technology_type="t3",
        performed_at="2026-01-01T00:00:00Z",
    )
    create_assay(client, study, "C", measurement_type="m3", technology_type="t2", platform="P1")

    assert list_names(client, study) == ["A", "B", "C"]
    assert list_names(client, study, sort="-name") == ["C", "B", "A"]
    assert list_names(client, study, sort="measurement_type") == ["B", "A", "C"]
    assert list_names(client, study, sort="technology_type") == ["A", "C", "B"]
    assert list_names(client, study, sort="platform") == ["C", "A", "B"]
    assert list_names(client, study, sort="-platform") == ["A", "C", "B"]
    assert list_names(client, study, sort="performed_at") == ["B", "A", "C"]
    assert list_names(client, study, sort="-performed_at") == ["A", "B", "C"]
    assert list_names(client, study, sort="-created_at") == ["C", "B", "A"]


def test_list_assays_rejects_an_unknown_sort(client: TestClient) -> None:
    study = create_study(client)
    assert client.get(f"{study}/assays", params={"sort": "colour"}).status_code == 422


def test_list_assays_searches_names_and_external_ids(client: TestClient) -> None:
    study = create_study(client)
    create_assay(client, study, "Run-01")
    create_assay(client, study, "Batch-01", external_id="RUN-99")
    create_assay(client, study, "100%_done")

    assert list_names(client, study, q="run") == ["Batch-01", "Run-01"]
    assert list_names(client, study, q="%") == ["100%_done"]
    assert list_names(client, study, q="nothing") == []


def test_list_assays_pages_through_results_with_a_total(client: TestClient) -> None:
    study = create_study(client)
    for name in ["A", "B", "C", "D", "E"]:
        create_assay(client, study, name)

    body = client.get(f"{study}/assays", params={"limit": 2, "offset": 2}).json()
    assert [a["name"] for a in body["items"]] == ["C", "D"]
    assert body["total"] == 5


def test_create_assay_records_audit_event(client: TestClient, database: Engine) -> None:
    study = create_study(client)
    create_assay(client, study, "A1")
    with database.connect() as conn:
        rows = conn.execute(
            text("SELECT entity_type FROM audit_event ORDER BY occurred_at, id")
        ).all()
    assert [row[0] for row in rows] == ["project", "study", "assay"]


def test_update_assay_changes_only_the_fields_sent(client: TestClient, database: Engine) -> None:
    study = create_study(client)
    assay_id = create_assay(client, study, "A1", platform="P1")

    response = client.patch(
        f"{API}/assays/{assay_id}", json={"platform": "P2", "measurement_type": "m2"}
    )
    assert response.status_code == 200
    body = response.json()
    assert (body["name"], body["platform"], body["measurement_type"]) == ("A1", "P2", "m2")
    assert datetime.fromisoformat(body["updated_at"]) > datetime.fromisoformat(body["created_at"])

    with database.connect() as conn:
        changes = conn.execute(
            text("SELECT changes FROM audit_event WHERE action = 'update'")
        ).scalar_one()
    assert changes == {
        "before": {"platform": "P1", "measurement_type": "transcription profiling"},
        "after": {"platform": "P2", "measurement_type": "m2"},
    }


def test_update_assay_with_no_real_changes_records_nothing(
    client: TestClient, database: Engine
) -> None:
    study = create_study(client)
    assay_id = create_assay(client, study, "A1")

    assert client.patch(f"{API}/assays/{assay_id}", json={"name": "A1"}).status_code == 200

    with database.connect() as conn:
        updates = conn.execute(
            text("SELECT count(*) FROM audit_event WHERE action = 'update'")
        ).scalar_one()
    assert updates == 0


def test_update_assay_can_clear_optional_fields_but_not_required_ones(
    client: TestClient,
) -> None:
    study = create_study(client)
    assay_id = create_assay(
        client,
        study,
        "A1",
        external_id="X-1",
        platform="P1",
        performed_at="2026-10-01T09:00:00Z",
    )

    response = client.patch(
        f"{API}/assays/{assay_id}",
        json={"external_id": None, "platform": None, "performed_at": None},
    )
    assert response.status_code == 200
    body = response.json()
    assert (body["external_id"], body["platform"], body["performed_at"]) == (None, None, None)

    for fields in [
        {"name": None},
        {"measurement_type": None},
        {"technology_type": None},
        {"parameters": None},
        {"study_id": "00000000-0000-7000-8000-000000000000"},
    ]:
        assert client.patch(f"{API}/assays/{assay_id}", json=fields).status_code == 422, fields


def test_update_assay_rejects_a_name_used_in_the_study(client: TestClient) -> None:
    study = create_study(client)
    create_assay(client, study, "A1")
    second = create_assay(client, study, "A2")

    assert client.patch(f"{API}/assays/{second}", json={"name": "A1"}).status_code == 409


def test_update_unknown_assay_returns_404(client: TestClient) -> None:
    unknown = f"{API}/assays/00000000-0000-7000-8000-000000000000"
    assert client.patch(unknown, json={"platform": "P1"}).status_code == 404


UNKNOWN = "00000000-0000-7000-8000-000000000000"


def create_sample(client: TestClient, study_url: str, name: str, **fields: object) -> str:
    response = client.post(
        f"{study_url}/samples", json={"name": name, "material_type": "RNA", **fields}
    )
    assert response.status_code == 201, response.json()
    sample_id: str = response.json()["id"]
    return sample_id


def linked(client: TestClient, assay_id: str, **params: str | int) -> list[tuple[str, str | None]]:
    response = client.get(f"{API}/assays/{assay_id}/samples", params=params)
    assert response.status_code == 200, response.json()
    return [(s["sample_name"], s["label"]) for s in response.json()["items"]]


def test_link_samples_to_an_assay(client: TestClient) -> None:
    study = create_study(client)
    assay_id = create_assay(client, study, "TMT-1")
    first = create_sample(client, study, "S1")
    second = create_sample(client, study, "S2")

    response = client.put(f"{API}/assays/{assay_id}/samples/{second}", json={"label": "126"})
    assert response.status_code == 201
    assert (response.json()["sample_name"], response.json()["label"]) == ("S2", "126")
    assert client.put(f"{API}/assays/{assay_id}/samples/{first}", json={}).status_code == 201

    assert linked(client, assay_id) == [("S1", None), ("S2", "126")]
    assert client.get(f"{API}/assays/{assay_id}").json()["sample_count"] == 2
    assert client.get(f"{study}/assays").json()["items"][0]["sample_count"] == 2


def test_linking_again_only_changes_the_label(client: TestClient, database: Engine) -> None:
    study = create_study(client)
    assay_id = create_assay(client, study, "TMT-1")
    sample_id = create_sample(client, study, "S1")
    url = f"{API}/assays/{assay_id}/samples/{sample_id}"

    assert client.put(url, json={"label": "126"}).status_code == 201
    assert client.put(url, json={"label": "126"}).status_code == 200
    assert client.put(url, json={"label": "127N"}).status_code == 200
    assert client.put(url, json={}).status_code == 200
    assert linked(client, assay_id) == [("S1", None)]

    with database.connect() as conn:
        rows = conn.execute(
            text(
                "SELECT action, changes FROM audit_event"
                " WHERE entity_type = 'assay' AND action <> 'create' ORDER BY occurred_at, id"
            )
        ).all()
    assert [row[0] for row in rows] == ["add_sample", "update_sample", "update_sample"]
    which = {"sample_id": sample_id, "sample": "S1"}
    assert rows[1][1] == {
        "before": {**which, "label": "126"},
        "after": {**which, "label": "127N"},
    }


def test_linked_samples_must_be_in_the_same_study(client: TestClient) -> None:
    first = create_study(client, "P1", "S1")
    second = create_study(client, "P1", "S2")
    assay_id = create_assay(client, first, "A1")
    other_sample = create_sample(client, second, "Other")

    for sample_id in [other_sample, UNKNOWN]:
        response = client.put(f"{API}/assays/{assay_id}/samples/{sample_id}", json={})
        assert response.status_code == 422
        assert "same study" in response.json()["detail"]


def test_unknown_assay_returns_404_for_its_samples(client: TestClient) -> None:
    study = create_study(client)
    sample_id = create_sample(client, study, "S1")
    unknown = f"{API}/assays/{UNKNOWN}"

    assert client.put(f"{unknown}/samples/{sample_id}", json={}).status_code == 404
    assert client.get(f"{unknown}/samples").status_code == 404
    assert client.delete(f"{unknown}/samples/{sample_id}").status_code == 404


def test_unlink_a_sample(client: TestClient, database: Engine) -> None:
    study = create_study(client)
    assay_id = create_assay(client, study, "TMT-1")
    sample_id = create_sample(client, study, "S1")
    url = f"{API}/assays/{assay_id}/samples/{sample_id}"
    client.put(url, json={"label": "126"})

    assert client.delete(url).status_code == 204
    assert linked(client, assay_id) == []
    assert client.delete(url).status_code == 404

    with database.connect() as conn:
        changes = conn.execute(
            text("SELECT changes FROM audit_event WHERE action = 'remove_sample'")
        ).scalar_one()
    assert changes == {"before": {"sample_id": sample_id, "sample": "S1", "label": "126"}}


def test_list_assay_samples_sorts_searches_and_pages(client: TestClient) -> None:
    study = create_study(client)
    assay_id = create_assay(client, study, "TMT-1")
    for name, label, external_id in [("A", "127N", "X-99"), ("B", "126", None), ("C", None, None)]:
        sample_id = create_sample(client, study, name, external_id=external_id)
        client.put(f"{API}/assays/{assay_id}/samples/{sample_id}", json={"label": label})

    assert linked(client, assay_id) == [("A", "127N"), ("B", "126"), ("C", None)]
    assert linked(client, assay_id, sort="-name") == [("C", None), ("B", "126"), ("A", "127N")]
    assert linked(client, assay_id, sort="label") == [("B", "126"), ("A", "127N"), ("C", None)]
    assert linked(client, assay_id, sort="-label") == [("A", "127N"), ("B", "126"), ("C", None)]
    assert linked(client, assay_id, q="x-99") == [("A", "127N")]

    body = client.get(f"{API}/assays/{assay_id}/samples", params={"limit": 1, "offset": 1}).json()
    assert [s["sample_name"] for s in body["items"]] == ["B"]
    assert body["total"] == 3


def test_list_a_samples_assays(client: TestClient) -> None:
    study = create_study(client)
    measured = create_sample(client, study, "S1")
    unmeasured = create_sample(client, study, "S2")
    rna = create_assay(client, study, "RNA-seq")
    proteomics = create_assay(client, study, "Proteomics", platform="Orbitrap")
    client.put(f"{API}/assays/{rna}/samples/{measured}", json={})
    client.put(f"{API}/assays/{proteomics}/samples/{measured}", json={"label": "126"})

    response = client.get(f"{API}/samples/{measured}/assays")
    assert response.status_code == 200
    assert [(a["assay_name"], a["platform"], a["label"]) for a in response.json()] == [
        ("Proteomics", "Orbitrap", "126"),
        ("RNA-seq", None, None),
    ]
    assert client.get(f"{API}/samples/{unmeasured}/assays").json() == []
    assert client.get(f"{API}/samples/{UNKNOWN}/assays").status_code == 404
