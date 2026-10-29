"""Tests that every change needs the right role, and records who made it."""

from fastapi.testclient import TestClient
from helpers import (
    ALICE,
    API,
    BOB,
    CAROL,
    OTHER_STUDY,
    PROJECT,
    STUDY,
    SignIn,
    every_change,
    make_records,
)
from sqlalchemy import Engine, text


def test_every_change_needs_someone_signed_in_with_the_right_role(
    client: TestClient, anonymous: TestClient, sign_in_as: SignIn, database: Engine
) -> None:
    ids = make_records(client)
    client.put(f"{PROJECT}/members/{BOB}", json={"role": "viewer"})
    bob = sign_in_as(BOB)
    with database.connect() as conn:
        events_before = conn.execute(text("SELECT count(*) FROM audit_event")).scalar_one()

    for method, url, body in every_change(ids):
        response = anonymous.request(method, url, json=body)
        assert response.status_code == 401, (method, url, response.json())
        assert response.json()["detail"] == "Please sign in to do this"
        response = client.request(method, url, json=body, headers=bob)
        assert response.status_code == 403, (method, url, response.json())
        assert response.json()["detail"] == "You don't have permission to do this"

    with database.connect() as conn:
        events_after = conn.execute(text("SELECT count(*) FROM audit_event")).scalar_one()
    assert events_after == events_before


def test_each_role_can_do_its_own_part(client: TestClient, sign_in_as: SignIn) -> None:
    make_records(client)
    client.put(f"{PROJECT}/members/{ALICE}", json={"role": "admin"})
    client.put(f"{PROJECT}/members/{BOB}", json={"role": "editor"})
    client.put(f"{STUDY}/members/{CAROL}", json={"role": "editor"})
    alice, bob, carol = sign_in_as(ALICE), sign_in_as(BOB), sign_in_as(CAROL)
    subject = {"subject_type": "patient"}

    # Only site administrators create projects.
    assert (
        client.post(f"{API}/projects", json={"code": "P2", "name": "P2"}, headers=alice).status_code
        == 403
    )
    # Project admins edit the project and create its studies; editors can't.
    assert client.patch(PROJECT, json={"name": "Pilot"}, headers=alice).status_code == 200
    assert client.patch(PROJECT, json={"name": "Pilot"}, headers=bob).status_code == 403
    new_study = {"code": "S3", "title": "S3"}
    assert client.post(f"{PROJECT}/studies", json=new_study, headers=bob).status_code == 403
    assert client.post(f"{PROJECT}/studies", json=new_study, headers=alice).status_code == 201

    # A project editor can edit every study in it; a study editor, only that study.
    assert (
        client.post(
            f"{OTHER_STUDY}/subjects", json={"name": "B", **subject}, headers=bob
        ).status_code
        == 201
    )
    assert (
        client.post(f"{STUDY}/subjects", json={"name": "C", **subject}, headers=carol).status_code
        == 201
    )
    assert (
        client.post(
            f"{OTHER_STUDY}/subjects", json={"name": "C", **subject}, headers=carol
        ).status_code
        == 403
    )
    assert client.patch(STUDY, json={"title": "Pilot study"}, headers=carol).status_code == 200
    response = client.post(
        f"{STUDY}/import", json={"source": "test", "dry_run": True}, headers=carol
    )
    assert response.status_code == 200


def test_changes_record_who_made_them(
    client: TestClient, sign_in_as: SignIn, database: Engine
) -> None:
    make_records(client)
    client.put(f"{STUDY}/members/{CAROL}", json={"role": "editor"})
    carol = sign_in_as(CAROL)

    response = client.post(
        f"{STUDY}/subjects", json={"name": "C-1", "subject_type": "patient"}, headers=carol
    )
    assert response.json()["created_by"] == f"orcid:{CAROL}"
    subject_id = response.json()["id"]
    client.patch(f"{API}/subjects/{subject_id}", json={"species": "Homo sapiens"}, headers=carol)

    with database.connect() as conn:
        rows = conn.execute(
            text(
                "SELECT action, actor FROM audit_event WHERE entity_id = :id"
                " ORDER BY occurred_at, id"
            ),
            {"id": subject_id},
        ).all()
    assert [tuple(row) for row in rows] == [
        ("create", f"orcid:{CAROL}"),
        ("update", f"orcid:{CAROL}"),
    ]
