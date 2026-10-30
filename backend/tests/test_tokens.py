"""Tests of personal API tokens: made on the website, used by scripts as their owner."""

from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi.testclient import TestClient
from helpers import ALICE, API, BOB, STUDY, SignIn, make_records
from sqlalchemy import Engine, text

TOKENS = f"{API}/auth/me/tokens"
ME = f"{API}/auth/me"


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def make_token(client: TestClient, headers: dict[str, str], **fields: Any) -> dict[str, Any]:
    response = client.post(TOKENS, json={"name": "GDC imports", **fields}, headers=headers)
    assert response.status_code == 201, response.json()
    made: dict[str, Any] = response.json()
    return made


def last_used(database: Engine) -> Any:
    with database.connect() as conn:
        return conn.execute(text("SELECT last_used_at FROM api_token")).scalar_one()


def test_a_token_is_shown_once_and_signs_its_owner_in(
    client: TestClient, anonymous: TestClient, sign_in_as: SignIn, database: Engine
) -> None:
    alice = sign_in_as(ALICE)
    made = make_token(client, alice)

    token = made["token"]
    assert token.startswith("plt_")
    assert made["hint"] == token[:8]
    assert made["name"] == "GDC imports"
    assert made["last_used_at"] is None
    lasts = datetime.fromisoformat(made["expires_at"]) - datetime.fromisoformat(made["created_at"])
    assert timedelta(days=89) < lasts <= timedelta(days=90, seconds=5)

    # Used without a browser session, it's Alice.
    assert anonymous.get(ME, headers=bearer(token)).json()["user"]["subject"] == ALICE

    # Listed without the token itself, and with when it was last used.
    [listed] = client.get(TOKENS, headers=alice).json()
    assert "token" not in listed
    assert listed["id"] == made["id"]
    assert listed["last_used_at"] is not None


def test_a_token_has_its_owners_permissions(
    client: TestClient, anonymous: TestClient, sign_in_as: SignIn, private: None
) -> None:
    make_records(client)
    client.put(f"{STUDY}/members/{ALICE}", json={"role": "editor"})
    token = make_token(client, sign_in_as(ALICE))["token"]

    subject = {"name": "A-1", "subject_type": "patient"}
    response = anonymous.post(f"{STUDY}/subjects", json=subject, headers=bearer(token))
    assert response.status_code == 201
    assert response.json()["created_by"] == f"orcid:{ALICE}"
    # Nothing more: she can't make a project.
    project = {"code": "P9", "name": "P9"}
    assert anonymous.post(f"{API}/projects", json=project, headers=bearer(token)).status_code == 403


def test_a_token_that_isnt_valid_is_refused_rather_than_ignored(
    client: TestClient, anonymous: TestClient, sign_in_as: SignIn, database: Engine
) -> None:
    for token in ("plt_nonsense", "nonsense"):
        response = anonymous.get(f"{API}/projects", headers=bearer(token))
        assert response.status_code == 401
        assert response.json() == {
            "detail": "This API token isn't valid: it may have expired or been revoked"
        }
        assert response.headers["WWW-Authenticate"] == "Bearer"

    # Nor once it has expired.
    token = make_token(client, sign_in_as(ALICE), days=1)["token"]
    with database.begin() as conn:
        conn.execute(text("UPDATE api_token SET expires_at = now() - interval '1 second'"))
    assert anonymous.get(ME, headers=bearer(token)).status_code == 401

    # Other kinds of Authorization header, and an empty one, are left alone.
    for header in ("Basic YWxpY2U6c2VjcmV0", "Bearer ", ""):
        response = anonymous.get(ME, headers={"Authorization": header})
        assert response.json()["user"] is None, header


def test_when_a_token_was_last_used_is_recorded_at_most_hourly(
    client: TestClient, anonymous: TestClient, sign_in_as: SignIn, database: Engine
) -> None:
    token = make_token(client, sign_in_as(ALICE))["token"]
    anonymous.get(ME, headers=bearer(token))
    first = last_used(database)
    anonymous.get(ME, headers=bearer(token))
    assert last_used(database) == first

    with database.begin() as conn:
        conn.execute(text("UPDATE api_token SET last_used_at = now() - interval '2 hours'"))
    anonymous.get(ME, headers=bearer(token))
    assert last_used(database) > datetime.now(UTC) - timedelta(minutes=1)


def test_tokens_are_managed_only_on_the_website(
    client: TestClient, anonymous: TestClient, sign_in_as: SignIn
) -> None:
    made = make_token(client, sign_in_as(ALICE))
    with_token = bearer(made["token"])

    for method, url, body in [
        ("GET", TOKENS, None),
        ("POST", TOKENS, {"name": "another"}),
        ("DELETE", f"{TOKENS}/{made['id']}", None),
    ]:
        response = anonymous.request(method, url, json=body, headers=with_token)
        assert response.status_code == 403, (method, url)
        assert response.json() == {
            "detail": "API tokens can only be managed on the website, when signed in"
        }
        assert anonymous.request(method, url, json=body).status_code == 401, (method, url)


def test_a_token_can_be_revoked_by_its_owner_only(
    client: TestClient, anonymous: TestClient, sign_in_as: SignIn
) -> None:
    alice, bob = sign_in_as(ALICE), sign_in_as(BOB)
    made = make_token(client, alice)

    assert client.delete(f"{TOKENS}/{made['id']}", headers=bob).status_code == 404
    assert client.get(TOKENS, headers=bob).json() == []
    assert anonymous.get(ME, headers=bearer(made["token"])).status_code == 200

    assert client.delete(f"{TOKENS}/{made['id']}", headers=alice).status_code == 204
    assert anonymous.get(ME, headers=bearer(made["token"])).status_code == 401
    response = client.delete(f"{TOKENS}/{made['id']}", headers=alice)
    assert (response.status_code, response.json()) == (404, {"detail": "API token not found"})
    assert client.get(TOKENS, headers=alice).json() == []


def test_making_and_revoking_tokens_is_in_the_owners_activity(
    client: TestClient, sign_in_as: SignIn
) -> None:
    alice = sign_in_as(ALICE)
    made = make_token(client, alice)

    [created] = client.get(f"{ME}/activity", headers=alice).json()["items"]
    assert (created["action"], created["entity_type"], created["name"]) == (
        "create",
        "api_token",
        "GDC imports",
    )

    client.delete(f"{TOKENS}/{made['id']}", headers=alice)
    revoked, created = client.get(f"{ME}/activity", headers=alice).json()["items"]
    assert (revoked["action"], revoked["name"]) == ("revoke", None)
    assert created["name"] is None


def test_a_token_needs_a_name_and_lasts_at_most_a_year(
    client: TestClient, sign_in_as: SignIn
) -> None:
    alice = sign_in_as(ALICE)
    for body in ({"name": ""}, {"name": "x", "days": 0}, {"name": "x", "days": 366}):
        assert client.post(TOKENS, json=body, headers=alice).status_code == 422, body
    assert client.get(TOKENS, headers=alice).json() == []
