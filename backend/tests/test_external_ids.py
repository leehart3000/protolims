"""Tests that external IDs are unique within a study, for every kind of record."""

import pytest
from fastapi.testclient import TestClient

API = "/api/v1"

# What each kind of record needs besides a name, and its path under a study.
REQUIRED = {
    "subjects": {"subject_type": "patient"},
    "samples": {"material_type": "tissue"},
    "assays": {"measurement_type": "m", "technology_type": "t"},
    "data-files": {"level": "raw", "format": "TSV"},
}


def create_study(client: TestClient, project: str = "P1", study: str = "S1") -> str:
    """Create a study (and its project, if needed); return the study's URL."""
    client.post(f"{API}/projects", json={"code": project, "name": f"Project {project}"})
    response = client.post(
        f"{API}/projects/{project}/studies", json={"code": study, "title": f"Study {study}"}
    )
    assert response.status_code == 201
    return f"{API}/projects/{project}/studies/{study}"


def record(kind: str, number: int, **fields: object) -> dict[str, object]:
    body: dict[str, object] = {"name": f"X{number}", **REQUIRED[kind], **fields}
    if kind == "data-files":
        body["uri"] = f"https://example.org/{number}"
    return body


@pytest.mark.parametrize("kind", list(REQUIRED))
def test_external_ids_are_unique_within_a_study(client: TestClient, kind: str) -> None:
    first = f"{create_study(client, 'P1', 'S1')}/{kind}"
    second = f"{create_study(client, 'P1', 'S2')}/{kind}"

    assert client.post(first, json=record(kind, 1, external_id="EXT-1")).status_code == 201
    assert client.post(second, json=record(kind, 1, external_id="EXT-1")).status_code == 201
    assert client.post(first, json=record(kind, 2)).status_code == 201
    assert client.post(first, json=record(kind, 3)).status_code == 201

    response = client.post(first, json=record(kind, 4, external_id="EXT-1"))
    assert response.status_code == 409
    assert response.json()["detail"].startswith("External ID 'EXT-1' is already used")

    other = client.post(first, json=record(kind, 5, external_id="EXT-5")).json()["id"]
    response = client.patch(f"{API}/{kind}/{other}", json={"external_id": "EXT-1"})
    assert response.status_code == 409
    assert response.json()["detail"].startswith("External ID 'EXT-1' is already used")


@pytest.mark.parametrize("kind", list(REQUIRED))
def test_empty_external_ids_are_refused(client: TestClient, kind: str) -> None:
    url = f"{create_study(client)}/{kind}"
    assert client.post(url, json=record(kind, 1, external_id="")).status_code == 422
