"""Tests for the project endpoints."""

from datetime import datetime

from fastapi.testclient import TestClient
from sqlalchemy import Engine, text

PROJECTS = "/api/v1/projects"


def test_create_and_get_project(client: TestClient) -> None:
    payload = {"code": "DEMO-1", "name": "Demo project", "licence": "CC0-1.0"}
    response = client.post(PROJECTS, json=payload)
    assert response.status_code == 201
    body = response.json()
    assert body["code"] == "DEMO-1"
    assert body["licence"] == "CC0-1.0"
    assert body["id"]

    response = client.get(f"{PROJECTS}/DEMO-1")
    assert response.status_code == 200
    assert response.json()["name"] == "Demo project"


def test_duplicate_code_is_rejected(client: TestClient) -> None:
    payload = {"code": "DUP", "name": "First"}
    assert client.post(PROJECTS, json=payload).status_code == 201
    response = client.post(PROJECTS, json=payload)
    assert response.status_code == 409


def test_invalid_code_is_rejected(client: TestClient) -> None:
    response = client.post(PROJECTS, json={"code": "has space", "name": "Bad"})
    assert response.status_code == 422


def test_unknown_field_is_rejected(client: TestClient) -> None:
    response = client.post(PROJECTS, json={"code": "X", "name": "X", "licnece": "typo"})
    assert response.status_code == 422


def test_list_projects_is_ordered_by_code(client: TestClient) -> None:
    client.post(PROJECTS, json={"code": "B", "name": "Second"})
    client.post(PROJECTS, json={"code": "A", "name": "First"})
    response = client.get(PROJECTS)
    assert response.status_code == 200
    assert [p["code"] for p in response.json()] == ["A", "B"]


def test_unknown_project_returns_404(client: TestClient) -> None:
    assert client.get(f"{PROJECTS}/NOPE").status_code == 404


def test_create_records_audit_event(client: TestClient, database: Engine) -> None:
    client.post(PROJECTS, json={"code": "AUDIT-1", "name": "Audited"})
    with database.connect() as conn:
        rows = conn.execute(text("SELECT action, entity_type FROM audit_event")).all()
    assert [tuple(row) for row in rows] == [("create", "project")]


def test_update_project_changes_only_the_fields_sent(client: TestClient, database: Engine) -> None:
    client.post(PROJECTS, json={"code": "P1", "name": "Pilot", "licence": "CC0-1.0"})

    response = client.patch(
        f"{PROJECTS}/P1",
        json={"name": "Pilot project", "citation": "Doe J et al. (2026) Nature 1:1"},
    )
    assert response.status_code == 200
    body = response.json()
    assert (body["code"], body["name"], body["licence"]) == ("P1", "Pilot project", "CC0-1.0")
    assert body["citation"] == "Doe J et al. (2026) Nature 1:1"
    assert datetime.fromisoformat(body["updated_at"]) > datetime.fromisoformat(body["created_at"])

    with database.connect() as conn:
        changes = conn.execute(
            text("SELECT changes FROM audit_event WHERE action = 'update'")
        ).scalar_one()
    assert changes == {
        "before": {"name": "Pilot", "citation": None},
        "after": {"name": "Pilot project", "citation": "Doe J et al. (2026) Nature 1:1"},
    }


def test_update_project_with_no_real_changes_records_nothing(
    client: TestClient, database: Engine
) -> None:
    client.post(PROJECTS, json={"code": "P1", "name": "Pilot"})

    assert client.patch(f"{PROJECTS}/P1", json={"name": "Pilot"}).status_code == 200

    with database.connect() as conn:
        updates = conn.execute(
            text("SELECT count(*) FROM audit_event WHERE action = 'update'")
        ).scalar_one()
    assert updates == 0


def test_update_project_can_clear_optional_fields_but_not_the_name(client: TestClient) -> None:
    client.post(PROJECTS, json={"code": "P1", "name": "Pilot", "licence": "CC0-1.0"})

    response = client.patch(f"{PROJECTS}/P1", json={"licence": None})
    assert response.status_code == 200
    assert response.json()["licence"] is None

    for fields in [{"name": None}, {"name": ""}, {"code": "P2"}]:
        assert client.patch(f"{PROJECTS}/P1", json=fields).status_code == 422, fields


def test_update_unknown_project_returns_404(client: TestClient) -> None:
    assert client.patch(f"{PROJECTS}/NOPE", json={"name": "X"}).status_code == 404
