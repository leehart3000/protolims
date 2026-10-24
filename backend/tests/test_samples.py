"""Tests for the sample endpoints."""

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


def create_subject(client: TestClient, study_url: str, name: str = "Patient-01") -> str:
    response = client.post(f"{study_url}/subjects", json={"name": name, "subject_type": "patient"})
    assert response.status_code == 201
    subject_id: str = response.json()["id"]
    return subject_id


def create_sample(client: TestClient, study_url: str, name: str, **fields: object) -> str:
    response = client.post(
        f"{study_url}/samples", json={"name": name, "material_type": "tissue", **fields}
    )
    assert response.status_code == 201, response.json()
    sample_id: str = response.json()["id"]
    return sample_id


def test_create_and_get_samples_with_subject_and_parent(client: TestClient) -> None:
    study = create_study(client)
    subject_id = create_subject(client, study)
    response = client.post(
        f"{study}/samples",
        json={
            "name": "S1",
            "material_type": "tissue",
            "subject_id": subject_id,
            "collected_at": "2026-10-01T09:00:00Z",
            "characteristics": {"tissue site": "breast"},
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "registered"
    assert body["subject_name"] == "Patient-01"
    assert (body["project_code"], body["study_code"]) == ("P1", "S1")

    aliquot_id = create_sample(
        client, study, "S1-RNA", material_type="RNA", parent_sample_id=body["id"]
    )
    response = client.get(f"{API}/samples/{aliquot_id}")
    assert response.status_code == 200
    aliquot = response.json()
    assert aliquot["material_type"] == "RNA"
    assert aliquot["parent_sample_name"] == "S1"
    assert aliquot["subject_name"] is None


def test_invalid_details_are_rejected(client: TestClient) -> None:
    study = create_study(client)
    for fields in [
        {"name": "has/slash", "material_type": "tissue"},
        {"name": "S1", "material_type": ""},
        {"name": "S1", "material_type": "tissue", "status": "lost"},
        {"name": "S1", "material_type": "tissue", "collected_at": "2026-10-01T09:00:00"},
    ]:
        response = client.post(f"{study}/samples", json=fields)
        assert response.status_code == 422, fields


def test_same_name_is_allowed_in_different_studies(client: TestClient) -> None:
    create_sample(client, create_study(client, "P1", "S1"), "Sample-01")
    create_sample(client, create_study(client, "P1", "S2"), "Sample-01")


def test_duplicate_name_in_same_study_is_rejected(client: TestClient) -> None:
    study = create_study(client)
    create_sample(client, study, "Sample-01")
    response = client.post(f"{study}/samples", json={"name": "Sample-01", "material_type": "blood"})
    assert response.status_code == 409


def test_subject_must_be_in_the_same_study(client: TestClient) -> None:
    first = create_study(client, "P1", "S1")
    second = create_study(client, "P1", "S2")
    other_subject = create_subject(client, second)
    for subject_id in [other_subject, "00000000-0000-7000-8000-000000000000"]:
        response = client.post(
            f"{first}/samples",
            json={"name": "X1", "material_type": "tissue", "subject_id": subject_id},
        )
        assert response.status_code == 422
        assert "subject" in response.json()["detail"]


def test_parent_must_be_in_the_same_study(client: TestClient) -> None:
    first = create_study(client, "P1", "S1")
    second = create_study(client, "P1", "S2")
    other_sample = create_sample(client, second, "Other")
    for parent_id in [other_sample, "00000000-0000-7000-8000-000000000000"]:
        response = client.post(
            f"{first}/samples",
            json={"name": "X1", "material_type": "tissue", "parent_sample_id": parent_id},
        )
        assert response.status_code == 422
        assert "parent" in response.json()["detail"]


def test_unknown_study_returns_404(client: TestClient) -> None:
    create_study(client)
    unknown = f"{API}/projects/P1/studies/NOPE/samples"
    assert client.post(unknown, json={"name": "X1", "material_type": "tissue"}).status_code == 404
    assert client.get(unknown).status_code == 404


def test_unknown_or_invalid_sample_id(client: TestClient) -> None:
    assert client.get(f"{API}/samples/00000000-0000-7000-8000-000000000000").status_code == 404
    assert client.get(f"{API}/samples/not-a-uuid").status_code == 422


def test_list_samples_only_returns_that_studys_samples(client: TestClient) -> None:
    first = create_study(client, "P1", "S1")
    second = create_study(client, "P1", "S2")
    subject_id = create_subject(client, first)
    create_sample(client, first, "B", subject_id=subject_id)
    create_sample(client, first, "A")
    create_sample(client, second, "C")
    response = client.get(f"{first}/samples")
    assert response.status_code == 200
    assert [(s["name"], s["subject_name"]) for s in response.json()] == [
        ("A", None),
        ("B", "Patient-01"),
    ]


def test_create_sample_records_audit_event(client: TestClient, database: Engine) -> None:
    study = create_study(client)
    create_sample(client, study, "X1")
    with database.connect() as conn:
        rows = conn.execute(
            text("SELECT entity_type FROM audit_event ORDER BY occurred_at, id")
        ).all()
    assert [row[0] for row in rows] == ["project", "study", "sample"]


def test_list_samples_can_filter_by_parent(client: TestClient) -> None:
    study = create_study(client)
    parent_id = create_sample(client, study, "S1")
    create_sample(client, study, "S1-RNA", parent_sample_id=parent_id)
    create_sample(client, study, "S2")
    response = client.get(f"{study}/samples", params={"parent": parent_id})
    assert response.status_code == 200
    assert [s["name"] for s in response.json()] == ["S1-RNA"]
