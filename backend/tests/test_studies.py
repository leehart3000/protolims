"""Tests for the study endpoints."""

from datetime import datetime

from fastapi.testclient import TestClient
from sqlalchemy import Engine, text

API = "/api/v1"


def create_project(client: TestClient, code: str) -> str:
    response = client.post(f"{API}/projects", json={"code": code, "name": f"Project {code}"})
    assert response.status_code == 201
    project_id: str = response.json()["id"]
    return project_id


def test_create_and_get_study(client: TestClient) -> None:
    project_id = create_project(client, "TCGA-BRCA")
    payload = {
        "code": "RNASEQ",
        "title": "RNA-seq of primary tumours",
        "design_factors": [{"name": "sample type", "description": "tumour or normal"}],
    }
    response = client.post(f"{API}/projects/TCGA-BRCA/studies", json=payload)
    assert response.status_code == 201
    body = response.json()
    assert body["project_id"] == project_id
    assert body["design_factors"] == [{"name": "sample type", "description": "tumour or normal"}]

    response = client.get(f"{API}/projects/TCGA-BRCA/studies/RNASEQ")
    assert response.status_code == 200
    assert response.json()["title"] == "RNA-seq of primary tumours"


def test_create_study_in_unknown_project_returns_404(client: TestClient) -> None:
    response = client.post(f"{API}/projects/NOPE/studies", json={"code": "S1", "title": "S"})
    assert response.status_code == 404


def test_same_study_code_is_allowed_in_different_projects(client: TestClient) -> None:
    create_project(client, "P1")
    create_project(client, "P2")
    payload = {"code": "PILOT", "title": "Pilot study"}
    assert client.post(f"{API}/projects/P1/studies", json=payload).status_code == 201
    assert client.post(f"{API}/projects/P2/studies", json=payload).status_code == 201


def test_duplicate_study_code_in_same_project_is_rejected(client: TestClient) -> None:
    create_project(client, "P1")
    payload = {"code": "PILOT", "title": "Pilot study"}
    assert client.post(f"{API}/projects/P1/studies", json=payload).status_code == 201
    response = client.post(f"{API}/projects/P1/studies", json=payload)
    assert response.status_code == 409
    assert "P1" in response.json()["detail"]


def test_get_study_only_finds_it_in_its_own_project(client: TestClient) -> None:
    create_project(client, "P1")
    create_project(client, "P2")
    client.post(f"{API}/projects/P1/studies", json={"code": "PILOT", "title": "Pilot"})
    assert client.get(f"{API}/projects/P1/studies/PILOT").status_code == 200
    assert client.get(f"{API}/projects/P2/studies/PILOT").status_code == 404
    assert client.get(f"{API}/projects/NOPE/studies/PILOT").status_code == 404


def test_list_studies_only_returns_that_projects_studies(client: TestClient) -> None:
    create_project(client, "P1")
    create_project(client, "P2")
    client.post(f"{API}/projects/P1/studies", json={"code": "B", "title": "B"})
    client.post(f"{API}/projects/P1/studies", json={"code": "A", "title": "A"})
    client.post(f"{API}/projects/P2/studies", json={"code": "A", "title": "Other"})
    response = client.get(f"{API}/projects/P1/studies")
    assert response.status_code == 200
    assert [s["title"] for s in response.json()] == ["A", "B"]


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


def test_list_all_studies_across_projects(client: TestClient) -> None:
    create_project(client, "P2")
    create_project(client, "P1")
    client.post(f"{API}/projects/P2/studies", json={"code": "A", "title": "P2 study A"})
    client.post(f"{API}/projects/P1/studies", json={"code": "B", "title": "P1 study B"})
    client.post(f"{API}/projects/P1/studies", json={"code": "A", "title": "P1 study A"})
    response = client.get(f"{API}/studies")
    assert response.status_code == 200
    body = response.json()
    assert [(s["project_code"], s["code"]) for s in body] == [("P1", "A"), ("P1", "B"), ("P2", "A")]
    assert body[0]["project_name"] == "Project P1"
    assert body[0]["title"] == "P1 study A"


def test_list_all_studies_can_filter_by_project(client: TestClient) -> None:
    create_project(client, "P1")
    create_project(client, "P2")
    client.post(f"{API}/projects/P1/studies", json={"code": "A", "title": "P1 study A"})
    client.post(f"{API}/projects/P2/studies", json={"code": "A", "title": "P2 study A"})
    response = client.get(f"{API}/studies", params={"project": "P2"})
    assert response.status_code == 200
    assert [(s["project_code"], s["title"]) for s in response.json()] == [("P2", "P2 study A")]


def test_list_all_studies_for_unknown_project_is_empty(client: TestClient) -> None:
    response = client.get(f"{API}/studies", params={"project": "NOPE"})
    assert response.status_code == 200
    assert response.json() == []


def create_study(client: TestClient, **fields: object) -> str:
    """Create study S1 in project P1; return its URL."""
    create_project(client, "P1")
    response = client.post(
        f"{API}/projects/P1/studies", json={"code": "S1", "title": "Pilot", **fields}
    )
    assert response.status_code == 201, response.json()
    return f"{API}/projects/P1/studies/S1"


def test_update_study_changes_only_the_fields_sent(client: TestClient, database: Engine) -> None:
    study = create_study(client, description="First look")
    factors = [{"name": "dose", "description": "mg/kg"}, {"name": "time", "description": None}]

    response = client.patch(study, json={"title": "Pilot study", "design_factors": factors})
    assert response.status_code == 200
    body = response.json()
    assert (body["code"], body["title"], body["description"]) == ("S1", "Pilot study", "First look")
    assert body["design_factors"] == factors
    assert datetime.fromisoformat(body["updated_at"]) > datetime.fromisoformat(body["created_at"])
    assert client.get(study).json()["design_factors"] == factors

    with database.connect() as conn:
        changes = conn.execute(
            text("SELECT changes FROM audit_event WHERE action = 'update'")
        ).scalar_one()
    assert changes == {
        "before": {"title": "Pilot", "design_factors": []},
        "after": {"title": "Pilot study", "design_factors": factors},
    }


def test_update_study_with_no_real_changes_records_nothing(
    client: TestClient, database: Engine
) -> None:
    study = create_study(client)

    assert client.patch(study, json={"title": "Pilot", "design_factors": []}).status_code == 200

    with database.connect() as conn:
        updates = conn.execute(
            text("SELECT count(*) FROM audit_event WHERE action = 'update'")
        ).scalar_one()
    assert updates == 0


def test_update_study_can_clear_the_description_but_not_required_fields(
    client: TestClient,
) -> None:
    study = create_study(client, description="First look")

    response = client.patch(study, json={"description": None})
    assert response.status_code == 200
    assert response.json()["description"] is None

    for fields in [
        {"title": None},
        {"title": ""},
        {"design_factors": None},
        {"design_factors": [{"name": ""}]},
        {"code": "S2"},
    ]:
        assert client.patch(study, json=fields).status_code == 422, fields


def test_update_unknown_study_returns_404(client: TestClient) -> None:
    create_project(client, "P1")
    response = client.patch(f"{API}/projects/P1/studies/NOPE", json={"title": "X"})
    assert response.status_code == 404
