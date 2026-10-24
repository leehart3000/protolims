"""Tests for the subject endpoints."""

from fastapi.testclient import TestClient
from sqlalchemy import Engine, text

API = "/api/v1"


def create_study(client: TestClient, project: str = "P1", study: str = "S1") -> str:
    """Create a study (and its project, if needed); return the study's subjects URL."""
    client.post(f"{API}/projects", json={"code": project, "name": f"Project {project}"})
    response = client.post(
        f"{API}/projects/{project}/studies", json={"code": study, "title": f"Study {study}"}
    )
    assert response.status_code == 201
    return f"{API}/projects/{project}/studies/{study}/subjects"


def test_create_and_get_subject(client: TestClient) -> None:
    subjects = create_study(client)
    payload = {
        "name": "TCGA-A1-A0SB",
        "external_id": "0004d251-3f70-4395-b175-c94c2f5b1b81",
        "subject_type": "patient",
        "species": "Homo sapiens",
        "attributes": {"sex": "female"},
    }
    response = client.post(subjects, json=payload)
    assert response.status_code == 201
    assert response.json()["attributes"] == {"sex": "female"}

    response = client.get(f"{subjects}/TCGA-A1-A0SB")
    assert response.status_code == 200
    assert response.json()["external_id"] == "0004d251-3f70-4395-b175-c94c2f5b1b81"


def test_names_may_contain_spaces(client: TestClient) -> None:
    subjects = create_study(client)
    payload = {"name": "Hs 578T", "subject_type": "cell_line"}
    assert client.post(subjects, json=payload).status_code == 201
    assert client.get(f"{subjects}/Hs%20578T").status_code == 200


def test_invalid_names_are_rejected(client: TestClient) -> None:
    subjects = create_study(client)
    for name in ["", " leading space", "trailing space ", "has/slash"]:
        response = client.post(subjects, json={"name": name, "subject_type": "patient"})
        assert response.status_code == 422, name


def test_unknown_subject_type_is_rejected(client: TestClient) -> None:
    subjects = create_study(client)
    response = client.post(subjects, json={"name": "X1", "subject_type": "alien"})
    assert response.status_code == 422


def test_same_name_is_allowed_in_different_studies(client: TestClient) -> None:
    first = create_study(client, "P1", "S1")
    second = create_study(client, "P1", "S2")
    payload = {"name": "Patient-01", "subject_type": "patient"}
    assert client.post(first, json=payload).status_code == 201
    assert client.post(second, json=payload).status_code == 201


def test_duplicate_name_in_same_study_is_rejected(client: TestClient) -> None:
    subjects = create_study(client)
    payload = {"name": "Patient-01", "subject_type": "patient"}
    assert client.post(subjects, json=payload).status_code == 201
    response = client.post(subjects, json=payload)
    assert response.status_code == 409
    assert "S1" in response.json()["detail"]


def test_unknown_study_returns_404(client: TestClient) -> None:
    create_study(client)
    unknown = f"{API}/projects/P1/studies/NOPE/subjects"
    assert client.post(unknown, json={"name": "X1", "subject_type": "patient"}).status_code == 404
    assert client.get(unknown).status_code == 404


def test_unknown_subject_returns_404(client: TestClient) -> None:
    subjects = create_study(client)
    assert client.get(f"{subjects}/NOPE").status_code == 404


def test_list_subjects_only_returns_that_studys_subjects(client: TestClient) -> None:
    first = create_study(client, "P1", "S1")
    second = create_study(client, "P1", "S2")
    client.post(first, json={"name": "B", "subject_type": "patient"})
    client.post(first, json={"name": "A", "subject_type": "patient"})
    client.post(second, json={"name": "C", "subject_type": "patient"})
    response = client.get(first)
    assert response.status_code == 200
    assert [s["name"] for s in response.json()] == ["A", "B"]


def test_create_subject_records_audit_event(client: TestClient, database: Engine) -> None:
    subjects = create_study(client)
    client.post(subjects, json={"name": "X1", "subject_type": "patient"})
    with database.connect() as conn:
        rows = conn.execute(
            text("SELECT entity_type FROM audit_event ORDER BY occurred_at, id")
        ).all()
    assert [row[0] for row in rows] == ["project", "study", "subject"]
