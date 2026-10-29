"""Tests for giving people roles on projects and studies."""

from collections.abc import Callable
from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy import Engine, text

# The sign_in_as fixture (see conftest.py): sign in by ORCID iD, get the request headers.
SignIn = Callable[..., dict[str, str]]

API = "/api/v1"
SITE_ADMIN = "0000-0001-5109-3700"  # PROTOLIMS_SITE_ADMINS in conftest.py
ALICE = "0000-0001-2345-6789"
BOB = "0000-0009-8765-4328"
CAROL = "0000-0001-1111-1118"
PROJECT = f"{API}/projects/P1"
STUDY = f"{PROJECT}/studies/S1"


def make_study(client: TestClient) -> None:
    """Project P1, with studies S1 and S2."""
    assert client.post(f"{API}/projects", json={"code": "P1", "name": "P1"}).status_code == 201
    for code in ("S1", "S2"):
        response = client.post(f"{PROJECT}/studies", json={"code": code, "title": code})
        assert response.status_code == 201


def roles(response: Any) -> list[tuple[str, str | None, str]]:
    assert response.status_code == 200, response.json()
    return [(m["user"]["subject"], m["user"]["name"], m["role"]) for m in response.json()]


def audit(database: Engine) -> list[tuple[str, str, str | None, Any]]:
    with database.connect() as conn:
        rows = conn.execute(
            text(
                "SELECT action, entity_type, actor, changes FROM audit_event"
                " WHERE action LIKE '%member' ORDER BY occurred_at, id"
            )
        ).all()
    return [tuple(row) for row in rows]


def test_project_admins_manage_the_projects_roles(
    client: TestClient, sign_in_as: SignIn, database: Engine
) -> None:
    make_study(client)
    admin = sign_in_as(SITE_ADMIN)

    response = client.put(f"{PROJECT}/members/{ALICE}", json={"role": "admin"}, headers=admin)
    assert response.status_code == 200
    assert response.json()["user"] | {"id": None} == {
        "id": None,
        "provider": "orcid",
        "subject": ALICE,
        "name": None,
    }

    # Alice was added before signing in; when she does, she's already a project admin.
    alice = sign_in_as(ALICE, "Alice")
    for role in ("editor", "editor", "viewer"):
        response = client.put(f"{PROJECT}/members/{BOB}", json={"role": role}, headers=alice)
        assert response.status_code == 200
    assert roles(client.get(f"{PROJECT}/members", headers=alice)) == [
        (ALICE, "Alice", "admin"),
        (BOB, None, "viewer"),
    ]

    assert client.delete(f"{PROJECT}/members/{BOB}", headers=alice).status_code == 204
    assert client.delete(f"{PROJECT}/members/{BOB}", headers=alice).status_code == 204
    assert client.delete(f"{PROJECT}/members/{CAROL}", headers=alice).status_code == 204
    assert roles(client.get(f"{PROJECT}/members", headers=admin)) == [(ALICE, "Alice", "admin")]

    # A repeated change isn't recorded twice.
    assert audit(database) == [
        (
            "set_member",
            "project",
            f"orcid:{SITE_ADMIN}",
            {"before": {"orcid": ALICE, "role": None}, "after": {"orcid": ALICE, "role": "admin"}},
        ),
        (
            "set_member",
            "project",
            f"orcid:{ALICE}",
            {"before": {"orcid": BOB, "role": None}, "after": {"orcid": BOB, "role": "editor"}},
        ),
        (
            "set_member",
            "project",
            f"orcid:{ALICE}",
            {
                "before": {"orcid": BOB, "role": "editor"},
                "after": {"orcid": BOB, "role": "viewer"},
            },
        ),
        (
            "remove_member",
            "project",
            f"orcid:{ALICE}",
            {"before": {"orcid": BOB, "role": "viewer"}, "after": {"orcid": BOB, "role": None}},
        ),
    ]


def test_only_admins_can_see_or_change_roles(
    client: TestClient, anonymous: TestClient, sign_in_as: SignIn
) -> None:
    make_study(client)
    admin = sign_in_as(SITE_ADMIN)
    client.put(f"{PROJECT}/members/{BOB}", json={"role": "editor"}, headers=admin)
    bob = sign_in_as(BOB)
    viewer = {"role": "viewer"}

    for where in (PROJECT, STUDY):
        assert anonymous.get(f"{where}/members").status_code == 401
        assert anonymous.put(f"{where}/members/{CAROL}", json=viewer).status_code == 401
        assert anonymous.delete(f"{where}/members/{CAROL}").status_code == 401
        assert client.get(f"{where}/members", headers=bob).status_code == 403
        assert client.put(f"{where}/members/{CAROL}", json=viewer, headers=bob).status_code == 403
        assert client.delete(f"{where}/members/{CAROL}", headers=bob).status_code == 403

    bad_id = f"{PROJECT}/members/0000-0001-2345-6780"
    assert client.put(bad_id, json={"role": "viewer"}, headers=admin).status_code == 422
    unknown_role = client.put(f"{PROJECT}/members/{CAROL}", json={"role": "owner"}, headers=admin)
    assert unknown_role.status_code == 422
    assert client.get(f"{API}/projects/NOPE/members", headers=admin).status_code == 404


def test_study_admins_manage_only_their_studys_roles(
    client: TestClient, sign_in_as: SignIn, database: Engine
) -> None:
    make_study(client)
    admin = sign_in_as(SITE_ADMIN)
    client.put(f"{PROJECT}/members/{ALICE}", json={"role": "admin"}, headers=admin)
    client.put(f"{PROJECT}/members/{BOB}", json={"role": "editor"}, headers=admin)
    assert (
        client.put(f"{STUDY}/members/{CAROL}", json={"role": "admin"}, headers=admin).status_code
        == 200
    )

    carol = sign_in_as(CAROL, "Carol")
    response = client.put(f"{STUDY}/members/{BOB}", json={"role": "admin"}, headers=carol)
    assert response.status_code == 200
    other_study = f"{PROJECT}/studies/S2/members/{BOB}"
    assert client.put(other_study, json={"role": "admin"}, headers=carol).status_code == 403
    assert client.get(f"{PROJECT}/members", headers=carol).status_code == 403

    # Bob is a project editor and a study admin, so he can manage the study's roles.
    bob = sign_in_as(BOB, "Bob")
    assert roles(client.get(f"{STUDY}/members", headers=bob)) == [
        (BOB, "Bob", "admin"),
        (CAROL, "Carol", "admin"),
    ]
    # Alice, a project admin, can manage every study in the project.
    alice = sign_in_as(ALICE)
    for _ in range(2):
        assert client.delete(f"{STUDY}/members/{BOB}", headers=alice).status_code == 204
    assert (
        client.put(f"{STUDY}/members/{BOB}", json={"role": "viewer"}, headers=alice).status_code
        == 200
    )
    assert (
        client.put(f"{STUDY}/members/{BOB}", json={"role": "viewer"}, headers=alice).status_code
        == 200
    )
    assert client.delete(f"{STUDY}/members/{ALICE}", headers=alice).status_code == 204
    assert client.delete(f"{STUDY}/members/0000-0002-2222-2224", headers=alice).status_code == 204

    assert [(action, entity) for action, entity, _, _ in audit(database)][-4:] == [
        ("set_member", "study"),
        ("set_member", "study"),
        ("remove_member", "study"),
        ("set_member", "study"),
    ]


def test_me_says_whether_someone_is_a_site_administrator(
    client: TestClient, anonymous: TestClient, sign_in_as: SignIn
) -> None:
    assert anonymous.get(f"{API}/auth/me").json() == {
        "user": None,
        "site_admin": False,
        "public_read": True,
    }
    assert client.get(f"{API}/auth/me", headers=sign_in_as(SITE_ADMIN)).json()["site_admin"]
    assert not client.get(f"{API}/auth/me", headers=sign_in_as(ALICE)).json()["site_admin"]
