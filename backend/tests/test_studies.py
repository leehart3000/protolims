"""Tests for the study endpoints."""

from fastapi.testclient import TestClient
from sqlalchemy import Engine, text

API = "/api/v1"


def create_project(client: TestClient, code: str) -> str:
    response = client.post(f"{API}/projects", json={"code": code, "name": f"Project {code}"})
    assert response.status_code == 201
    project_id: str = response.json()["id"]
    return project_id


def test_create_and_get_study(client: TestClient) -> None:
    project_id = create_project(client, "TCGA")
    payload = {
        "code": "TCGA-BRCA",
        "title": "Breast invasive carcinoma",
        "design_factors": [{"name": "sample type", "description": "tumour or normal"}],
    }
    response = client.post(f"{API}/projects/TCGA/studies", json=payload)
    assert response.status_code == 201
    body = response.json()
    assert body["project_id"] == project_id
    assert body["design_factors"] == [{"name": "sample type", "description": "tumour or normal"}]

    response = client.get(f"{API}/studies/TCGA-BRCA")
    assert response.status_code == 200
    assert response.json()["title"] == "Breast invasive carcinoma"


def test_create_study_in_unknown_project_returns_404(client: TestClient) -> None:
    response = client.post(f"{API}/projects/NOPE/studies", json={"code": "S1", "title": "S"})
    assert response.status_code == 404


def test_duplicate_study_code_is_rejected_across_projects(client: TestClient) -> None:
    create_project(client, "P1")
    create_project(client, "P2")
    payload = {"code": "SAME", "title": "Study"}
    assert client.post(f"{API}/projects/P1/studies", json=payload).status_code == 201
    assert client.post(f"{API}/projects/P2/studies", json=payload).status_code == 409


def test_list_studies_only_returns_that_projects_studies(client: TestClient) -> None:
    create_project(client, "P1")
    create_project(client, "P2")
    client.post(f"{API}/projects/P1/studies", json={"code": "P1-B", "title": "B"})
    client.post(f"{API}/projects/P1/studies", json={"code": "P1-A", "title": "A"})
    client.post(f"{API}/projects/P2/studies", json={"code": "P2-A", "title": "Other"})
    response = client.get(f"{API}/projects/P1/studies")
    assert response.status_code == 200
    assert [s["code"] for s in response.json()] == ["P1-A", "P1-B"]


def test_invalid_design_factor_is_rejected(client: TestClient) -> None:
    create_project(client, "P1")
    payload = {"code": "S1", "title": "S", "design_factors": [{"name": ""}]}
    response = client.post(f"{API}/projects/P1/studies", json=payload)
    assert response.status_code == 422


def test_create_study_records_audit_event(client: TestClient, database: Engine) -> None:
    create_project(client, "P1")
    client.post(f"{API}/projects/P1/studies", json={"code": "S1", "title": "S"})
    with database.connect() as conn:
        rows = conn.execute(
            text("SELECT entity_type FROM audit_event ORDER BY occurred_at, id")
        ).all()
    assert [row[0] for row in rows] == ["project", "study"]
