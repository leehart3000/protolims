"""Tests of deleting an empty study or project: only one with nothing in it, and only by whoever
can create one there."""

from typing import Any

from fastapi.testclient import TestClient
from helpers import ALICE, API, BOB, CAROL, OTHER_STUDY, PROJECT, STUDY, SignIn, make_records
from sqlalchemy import Engine, text


def deletions(database: Engine) -> list[tuple[str, Any]]:
    """The audit trail's deletions, oldest first, as (entity type, changes)."""
    with database.connect() as conn:
        rows = conn.execute(
            text(
                "SELECT entity_type, changes FROM audit_event"
                " WHERE action = 'delete' ORDER BY occurred_at, id"
            )
        ).all()
    return [(row[0], row[1]) for row in rows]


def count(database: Engine, table: str) -> int:
    with database.connect() as conn:
        found: int = conn.execute(text(f"SELECT count(*) FROM {table}")).scalar_one()
    return found


def test_an_empty_study_is_deleted_with_its_roles(client: TestClient, database: Engine) -> None:
    make_records(client)  # Its records are all in S1, so S2 is empty.
    client.put(f"{OTHER_STUDY}/members/{ALICE}", json={"role": "viewer"})
    assert count(database, "study_member") == 1

    assert client.delete(OTHER_STUDY).status_code == 204
    assert client.get(OTHER_STUDY).status_code == 404
    assert count(database, "study_member") == 0
    [(entity_type, changes)] = deletions(database)
    assert entity_type == "study"
    assert {key: changes["before"][key] for key in ("project", "code", "title", "roles")} == {
        "project": "P1",
        "code": "S2",
        "title": "S2",
        "roles": 1,
    }

    # Its code can be used again, and deleting it again finds nothing.
    response = client.post(f"{PROJECT}/studies", json={"code": "S2", "title": "Again"})
    assert response.status_code == 201
    assert client.delete(f"{PROJECT}/studies/NOPE").status_code == 404


def test_a_study_with_records_is_not_deleted(client: TestClient, database: Engine) -> None:
    make_records(client)

    response = client.delete(STUDY)
    assert (response.status_code, response.json()["detail"]) == (
        409,
        "Study 'S1' still has 1 subject, 1 sample, 1 assay, 2 data files, so it can't be "
        "deleted: only an empty study can be",
    )
    assert client.get(STUDY).status_code == 200
    assert deletions(database) == []


def test_only_the_projects_admins_can_delete_a_study(
    client: TestClient, anonymous: TestClient, sign_in_as: SignIn
) -> None:
    make_records(client)
    client.put(f"{OTHER_STUDY}/members/{ALICE}", json={"role": "admin"})
    client.put(f"{PROJECT}/members/{CAROL}", json={"role": "editor"})
    client.put(f"{PROJECT}/members/{BOB}", json={"role": "admin"})

    # Not even the study's own admin, as only the project's admins can create a study.
    assert client.delete(OTHER_STUDY, headers=sign_in_as(ALICE)).status_code == 403
    assert client.delete(OTHER_STUDY, headers=sign_in_as(CAROL)).status_code == 403
    assert anonymous.delete(OTHER_STUDY).status_code == 401
    assert client.get(OTHER_STUDY).status_code == 200

    assert client.delete(OTHER_STUDY, headers=sign_in_as(BOB)).status_code == 204


def test_a_project_without_studies_is_deleted_with_its_roles(
    client: TestClient, database: Engine
) -> None:
    assert client.post(f"{API}/projects", json={"code": "P9", "name": "P9"}).status_code == 201
    client.put(f"{API}/projects/P9/members/{ALICE}", json={"role": "editor"})

    assert client.delete(f"{API}/projects/P9").status_code == 204
    assert client.get(f"{API}/projects/P9").status_code == 404
    assert count(database, "project_member") == 0
    [(entity_type, changes)] = deletions(database)
    assert entity_type == "project"
    assert (changes["before"]["code"], changes["before"]["roles"]) == ("P9", 1)
    assert client.delete(f"{API}/projects/P9").status_code == 404


def test_a_project_with_studies_is_not_deleted(client: TestClient) -> None:
    make_records(client)

    response = client.delete(PROJECT)
    assert (response.status_code, response.json()["detail"]) == (
        409,
        "Project 'P1' still has 2 studies, so it can't be deleted: delete its studies first "
        "(only empty ones can be)",
    )

    # With one study left, it says so.
    client.delete(OTHER_STUDY)
    assert "still has 1 study," in client.delete(PROJECT).json()["detail"]


def test_only_site_administrators_can_delete_a_project(
    client: TestClient, anonymous: TestClient, sign_in_as: SignIn
) -> None:
    assert client.post(f"{API}/projects", json={"code": "P9", "name": "P9"}).status_code == 201
    client.put(f"{API}/projects/P9/members/{BOB}", json={"role": "admin"})

    assert client.delete(f"{API}/projects/P9", headers=sign_in_as(BOB)).status_code == 403
    assert anonymous.delete(f"{API}/projects/P9").status_code == 401
    assert client.get(f"{API}/projects/P9").status_code == 200
