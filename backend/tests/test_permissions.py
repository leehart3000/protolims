"""Tests that every change needs the right role, and records who made it."""

from collections.abc import Callable
from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy import Engine, text

# The sign_in_as fixture (see conftest.py): sign in by ORCID iD, get the request headers.
SignIn = Callable[..., dict[str, str]]

API = "/api/v1"
PROJECT = f"{API}/projects/P1"
STUDY = f"{PROJECT}/studies/S1"
OTHER_STUDY = f"{PROJECT}/studies/S2"
ALICE = "0000-0001-2345-6789"
BOB = "0000-0009-8765-4328"
CAROL = "0000-0001-1111-1118"


def created_id(response: Any) -> str:
    assert response.status_code == 201, response.json()
    record_id: str = response.json()["id"]
    return record_id


def make_records(client: TestClient) -> dict[str, str]:
    """As the site administrator: project P1 with studies S1 and S2, and in S1 a subject, a
    sample, an assay and two data files. Returns their IDs."""
    assert client.post(f"{API}/projects", json={"code": "P1", "name": "P1"}).status_code == 201
    for code in ("S1", "S2"):
        response = client.post(f"{PROJECT}/studies", json={"code": code, "title": code})
        assert response.status_code == 201
    file = {"level": "raw", "format": "BAM"}
    return {
        "subject": created_id(
            client.post(f"{STUDY}/subjects", json={"name": "P-1", "subject_type": "patient"})
        ),
        "sample": created_id(
            client.post(f"{STUDY}/samples", json={"name": "T-1", "material_type": "tissue"})
        ),
        "assay": created_id(
            client.post(
                f"{STUDY}/assays",
                json={"name": "Run-1", "measurement_type": "m", "technology_type": "t"},
            )
        ),
        "file": created_id(
            client.post(
                f"{STUDY}/data-files",
                json={"name": "a.bam", "uri": "https://example.org/a.bam", **file},
            )
        ),
        "other_file": created_id(
            client.post(
                f"{STUDY}/data-files",
                json={"name": "b.bam", "uri": "https://example.org/b.bam", **file},
            )
        ),
    }


def every_change(ids: dict[str, str]) -> list[tuple[str, str, Any]]:
    """Every kind of change the API allows (other than to roles), as (method, URL, body)."""
    assay_sample = f"{API}/assays/{ids['assay']}/samples/{ids['sample']}"
    file_sample = f"{API}/data-files/{ids['file']}/samples/{ids['sample']}"
    file_input = f"{API}/data-files/{ids['file']}/inputs/{ids['other_file']}"
    return [
        ("POST", f"{API}/projects", {"code": "P9", "name": "P9"}),
        ("PATCH", PROJECT, {"name": "Renamed"}),
        ("POST", f"{PROJECT}/studies", {"code": "S9", "title": "S9"}),
        ("PATCH", STUDY, {"title": "Renamed"}),
        ("POST", f"{STUDY}/subjects", {"name": "P-2", "subject_type": "patient"}),
        ("PATCH", f"{API}/subjects/{ids['subject']}", {"name": "P-3"}),
        ("POST", f"{STUDY}/samples", {"name": "T-2", "material_type": "tissue"}),
        ("PATCH", f"{API}/samples/{ids['sample']}", {"name": "T-3"}),
        (
            "POST",
            f"{STUDY}/assays",
            {"name": "Run-2", "measurement_type": "m", "technology_type": "t"},
        ),
        ("PATCH", f"{API}/assays/{ids['assay']}", {"name": "Run-3"}),
        ("PUT", assay_sample, {}),
        ("DELETE", assay_sample, None),
        (
            "POST",
            f"{STUDY}/data-files",
            {"name": "c.bam", "uri": "https://example.org/c.bam", "level": "raw", "format": "BAM"},
        ),
        ("PATCH", f"{API}/data-files/{ids['file']}", {"name": "d.bam"}),
        ("PUT", file_sample, {}),
        ("DELETE", file_sample, None),
        ("PUT", file_input, None),
        ("DELETE", file_input, None),
        ("POST", f"{STUDY}/import", {"source": "test", "dry_run": True}),
    ]


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
