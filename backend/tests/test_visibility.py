"""Tests of who can see what on a private instance (public reading off).

People see the studies they have a role on, through the project or the study itself, and the
projects those studies are in. Anything they can't see is not found (404), even when they try
to change it, so its existence isn't revealed. Something they can see but not change is
forbidden (403).
"""

from typing import Any

from fastapi.testclient import TestClient
from helpers import (
    ALICE,
    API,
    BOB,
    CAROL,
    DAVE,
    OTHER_STUDY,
    PROJECT,
    STUDY,
    SignIn,
    every_change,
    make_records,
)
from sqlalchemy import Engine, text


def codes(response: Any) -> list[str]:
    assert response.status_code == 200, response.json()
    return [item["code"] for item in response.json()["items"]]


def reads(ids: dict[str, str]) -> list[str]:
    """Everything that can be read about study S1 and its records (other than its roles)."""
    return [
        STUDY,
        f"{STUDY}/subjects",
        f"{STUDY}/samples",
        f"{STUDY}/assays",
        f"{STUDY}/data-files",
        f"{API}/subjects/{ids['subject']}",
        f"{API}/samples/{ids['sample']}",
        f"{API}/samples/{ids['sample']}/assays",
        f"{API}/samples/{ids['sample']}/data-files",
        f"{API}/assays/{ids['assay']}",
        f"{API}/assays/{ids['assay']}/samples",
        f"{API}/data-files/{ids['file']}",
        f"{API}/data-files/{ids['file']}/samples",
        f"{API}/data-files/{ids['file']}/inputs",
        f"{API}/data-files/{ids['file']}/outputs",
    ]


def audit_count(database: Engine) -> int:
    with database.connect() as conn:
        count: int = conn.execute(text("SELECT count(*) FROM audit_event")).scalar_one()
    return count


def test_a_private_instance_needs_signing_in_for_everything_but_signing_in(
    client: TestClient, anonymous: TestClient, private: None, database: Engine
) -> None:
    ids = make_records(client)
    events_before = audit_count(database)

    for url in [f"{API}/projects", f"{API}/studies", PROJECT, f"{PROJECT}/studies", *reads(ids)]:
        response = anonymous.get(url)
        assert response.status_code == 401, url
        assert response.json()["detail"] == "Please sign in to do this"
    for method, url, body in every_change(ids):
        response = anonymous.request(method, url, json=body)
        assert response.status_code == 401, (method, url)
    assert audit_count(database) == events_before

    # Signing in, and finding out whether you are, stay open, as do the health checks.
    assert anonymous.get(f"{API}/auth/me").json() == {
        "user": None,
        "site_admin": False,
        "public_read": False,
        "read_only": False,
        "roles": [],
    }
    assert anonymous.get(f"{API}/auth/orcid/login", follow_redirects=False).status_code == 302
    assert anonymous.get("/health").status_code == 200


def test_people_see_only_the_projects_and_studies_they_have_roles_on(
    client: TestClient, sign_in_as: SignIn, private: None
) -> None:
    make_records(client)  # P1, with studies S1 and S2.
    for project in ("P2", "P3"):
        client.post(f"{API}/projects", json={"code": project, "name": project})
    client.post(f"{API}/projects/P2/studies", json={"code": "S3", "title": "S3"})
    client.put(f"{PROJECT}/members/{ALICE}", json={"role": "viewer"})
    client.put(f"{STUDY}/members/{BOB}", json={"role": "viewer"})
    client.put(f"{API}/projects/P3/members/{CAROL}", json={"role": "viewer"})
    alice, bob, carol, dave = (sign_in_as(who) for who in (ALICE, BOB, CAROL, DAVE))

    # The site administrator sees everything.
    assert codes(client.get(f"{API}/projects")) == ["P1", "P2", "P3"]
    assert codes(client.get(f"{API}/studies")) == ["S1", "S2", "S3"]

    # A project role shows the project and all its studies (P3 has none yet).
    assert codes(client.get(f"{API}/projects", headers=alice)) == ["P1"]
    assert codes(client.get(f"{PROJECT}/studies", headers=alice)) == ["S1", "S2"]
    assert codes(client.get(f"{API}/studies", headers=alice)) == ["S1", "S2"]
    assert codes(client.get(f"{API}/projects", headers=carol)) == ["P3"]
    assert codes(client.get(f"{API}/studies", headers=carol)) == []

    # A study role shows that study, and the project's details, but not its other studies.
    assert codes(client.get(f"{API}/projects", headers=bob)) == ["P1"]
    assert client.get(PROJECT, headers=bob).status_code == 200
    assert codes(client.get(f"{PROJECT}/studies", headers=bob)) == ["S1"]
    assert codes(client.get(f"{API}/studies", headers=bob)) == ["S1"]
    assert client.get(STUDY, headers=bob).status_code == 200

    # No role: nothing to see. The counts match, so they don't give anything away either.
    for path in ("projects", "studies"):
        response = client.get(f"{API}/{path}", headers=dave)
        assert response.json() == {"items": [], "total": 0}
    assert client.get(f"{API}/studies", params={"project": "P2"}, headers=alice).json() == {
        "items": [],
        "total": 0,
    }

    # Something hidden answers exactly as if it didn't exist.
    hidden = client.get(f"{API}/projects/P2", headers=alice)
    assert (hidden.status_code, hidden.json()) == (404, {"detail": "Project 'P2' not found"})
    assert client.get(f"{API}/projects/P2/studies", headers=alice).status_code == 404
    hidden = client.get(OTHER_STUDY, headers=bob)
    assert (hidden.status_code, hidden.json()) == (
        404,
        {"detail": "Study 'S2' not found in project 'P1'"},
    )
    missing = client.get(f"{PROJECT}/studies/S9", headers=bob)
    assert missing.json() == {"detail": "Study 'S9' not found in project 'P1'"}


def test_records_in_a_hidden_study_are_not_found(
    client: TestClient, sign_in_as: SignIn, private: None
) -> None:
    ids = make_records(client)  # The records are all in S1.
    client.put(f"{PROJECT}/members/{ALICE}", json={"role": "viewer"})
    client.put(f"{OTHER_STUDY}/members/{BOB}", json={"role": "viewer"})
    alice, bob = sign_in_as(ALICE), sign_in_as(BOB)

    for url in reads(ids):
        assert client.get(url, headers=alice).status_code == 200, url
        response = client.get(url, headers=bob)
        assert response.status_code == 404, url
        assert "not found" in response.json()["detail"], url

    # Only admins can see a study's roles, but Bob can't even see that S1 exists.
    assert client.get(f"{STUDY}/members", headers=alice).status_code == 403
    assert client.get(f"{STUDY}/members", headers=bob).status_code == 404
    assert client.get(f"{OTHER_STUDY}/members", headers=bob).status_code == 403


def test_changing_something_hidden_is_not_found_and_changes_nothing(
    client: TestClient, sign_in_as: SignIn, private: None, database: Engine
) -> None:
    ids = make_records(client)
    client.put(f"{PROJECT}/members/{ALICE}", json={"role": "viewer"})
    client.put(f"{OTHER_STUDY}/members/{BOB}", json={"role": "editor"})
    alice, bob = sign_in_as(ALICE), sign_in_as(BOB)
    events_before = audit_count(database)

    # Changes to the project itself are forbidden for both, as they can see it.
    in_project = {f"{API}/projects", PROJECT, f"{PROJECT}/studies"}
    for method, url, body in every_change(ids):
        response = client.request(method, url, json=body, headers=alice)
        assert response.status_code == 403, (method, url)
        response = client.request(method, url, json=body, headers=bob)
        assert response.status_code == (403 if url in in_project else 404), (method, url)
    for orcid_id in (CAROL, DAVE):
        response = client.put(f"{STUDY}/members/{orcid_id}", json={"role": "viewer"}, headers=bob)
        assert response.status_code == 404
    assert audit_count(database) == events_before

    # In his own study, Bob can still make changes.
    subject = {"name": "B-1", "subject_type": "patient"}
    response = client.post(f"{OTHER_STUDY}/subjects", json=subject, headers=bob)
    assert response.status_code == 201
