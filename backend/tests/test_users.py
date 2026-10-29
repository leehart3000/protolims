"""Tests for the site administrators' list of everyone."""

from typing import Any

from fastapi.testclient import TestClient
from helpers import ALICE, API, BOB, CAROL, PROJECT, SITE_ADMIN, STUDY, SignIn, make_records
from sqlalchemy import Engine, text

USERS = f"{API}/users"


def people(response: Any) -> list[tuple[str, str | None]]:
    assert response.status_code == 200, response.json()
    return [(user["subject"], user["name"]) for user in response.json()["items"]]


def test_site_administrators_see_everyone_with_their_roles(
    client: TestClient, sign_in_as: SignIn
) -> None:
    make_records(client)
    sign_in_as(ALICE, "Alice")
    sign_in_as(BOB, "Bob")
    client.put(f"{PROJECT}/members/{ALICE}", json={"role": "editor"})
    client.put(f"{STUDY}/members/{ALICE}", json={"role": "admin"})
    # Carol hasn't signed in yet: she was added by her ORCID iD.
    client.put(f"{STUDY}/members/{CAROL}", json={"role": "viewer"})

    response = client.get(USERS)
    assert people(response) == [
        (ALICE, "Alice"),
        (BOB, "Bob"),
        (CAROL, None),
        (SITE_ADMIN, None),
    ]
    assert response.json()["total"] == 4
    alice, bob, carol, site_admin = response.json()["items"]
    assert alice["roles"] == [
        {"project": "P1", "study": None, "role": "editor"},
        {"project": "P1", "study": "S1", "role": "admin"},
    ]
    assert bob["roles"] == []
    assert (alice["site_admin"], site_admin["site_admin"]) == (False, True)
    assert alice["last_signed_in_at"] is not None
    assert carol["last_signed_in_at"] is None
    assert carol["roles"] == [{"project": "P1", "study": "S1", "role": "viewer"}]


def test_users_can_be_searched_sorted_and_paged(
    client: TestClient, sign_in_as: SignIn, database: Engine
) -> None:
    sign_in_as(ALICE, "Alice Smith")
    sign_in_as(BOB, "Bob Jones")
    with database.begin() as conn:
        conn.execute(text("UPDATE app_user SET last_signed_in_at = now() + interval '1 hour'"))
        conn.execute(
            text("UPDATE app_user SET last_signed_in_at = NULL WHERE subject = :subject"),
            {"subject": BOB},
        )

    assert people(client.get(USERS, params={"q": "smith"})) == [(ALICE, "Alice Smith")]
    assert people(client.get(USERS, params={"q": BOB[-4:]})) == [(BOB, "Bob Jones")]
    assert people(client.get(USERS, params={"q": "%"})) == []
    assert people(client.get(USERS, params={"sort": "-name"})) == [
        (BOB, "Bob Jones"),
        (ALICE, "Alice Smith"),
        (SITE_ADMIN, None),
    ]
    # Bob hasn't signed in, so comes last either way.
    by_last_sign_in = people(client.get(USERS, params={"sort": "-last_signed_in_at"}))
    assert by_last_sign_in[-1] == (BOB, "Bob Jones")
    page = client.get(USERS, params={"sort": "created_at", "limit": 1, "offset": 1}).json()
    assert (len(page["items"]), page["total"]) == (1, 3)


def test_only_site_administrators_can_see_everyone(
    client: TestClient, anonymous: TestClient, sign_in_as: SignIn
) -> None:
    assert anonymous.get(USERS).status_code == 401
    assert client.get(USERS, headers=sign_in_as(ALICE)).status_code == 403
