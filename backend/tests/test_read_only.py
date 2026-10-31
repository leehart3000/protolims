"""Tests of the read-only lock (PROTOLIMS_READ_ONLY): nothing can be changed while it's on."""

import pytest
from fastapi.testclient import TestClient
from helpers import ALICE, API, PROJECT, STUDY, SignIn, every_change, make_records
from sqlalchemy import Engine, text

from protolims_api.config import get_settings
from protolims_api.read_only import allowed_while_read_only

LOCKED = {"detail": "This site is read-only at the moment, so nothing can be changed."}


@pytest.fixture
def read_only(monkeypatch: pytest.MonkeyPatch) -> None:
    """The read-only lock on, for this test."""
    monkeypatch.setattr(get_settings(), "read_only", True)


def audit_count(database: Engine) -> int:
    with database.connect() as conn:
        count: int = conn.execute(text("SELECT count(*) FROM audit_event")).scalar_one()
    return count


def test_nothing_can_be_changed_while_read_only(
    client: TestClient, database: Engine, monkeypatch: pytest.MonkeyPatch
) -> None:
    ids = make_records(client)
    client.put(f"{PROJECT}/members/{ALICE}", json={"role": "viewer"})
    monkeypatch.setattr(get_settings(), "read_only", True)
    events_before = audit_count(database)

    # Even by a site administrator.
    for method, url, body in every_change(ids):
        response = client.request(method, url, json=body)
        if url.endswith("/import"):
            assert response.status_code == 200, url  # Only a dry run, which saves nothing.
        else:
            assert (response.status_code, response.json()) == (423, LOCKED), (method, url)
    for method, url, body in [
        ("PUT", f"{STUDY}/members/{ALICE}", {"role": "editor"}),
        ("DELETE", f"{PROJECT}/members/{ALICE}", None),
        ("DELETE", f"{API}/users/{ALICE}", None),
        ("POST", f"{API}/auth/me/tokens", {"name": "x"}),
    ]:
        assert client.request(method, url, json=body).status_code == 423, (method, url)
    assert audit_count(database) == events_before

    # Reading still works.
    assert client.get(STUDY).status_code == 200
    assert client.get(f"{STUDY}/samples").json()["total"] == 1


def test_an_import_can_only_be_a_dry_run_while_read_only(
    client: TestClient, database: Engine, monkeypatch: pytest.MonkeyPatch
) -> None:
    make_records(client)
    monkeypatch.setattr(get_settings(), "read_only", True)
    request = {"source": "test", "subjects": [{"name": "P-9", "subject_type": "patient"}]}

    dry_run = client.post(f"{STUDY}/import", json=request | {"dry_run": True})
    assert dry_run.json()["subjects"]["created"] == 1
    saving = client.post(f"{STUDY}/import", json=request | {"dry_run": False})
    assert (saving.status_code, saving.json()) == (423, LOCKED)
    assert client.get(f"{STUDY}/subjects").json()["total"] == 1


def test_signing_out_and_revoking_tokens_still_work_while_read_only(
    client: TestClient, sign_in_as: SignIn, monkeypatch: pytest.MonkeyPatch
) -> None:
    alice = sign_in_as(ALICE)
    token = client.post(f"{API}/auth/me/tokens", json={"name": "x"}, headers=alice).json()
    monkeypatch.setattr(get_settings(), "read_only", True)

    assert client.delete(f"{API}/auth/me/tokens/{token['id']}", headers=alice).status_code == 204
    assert client.post(f"{API}/auth/logout", headers=alice).status_code == 204
    assert client.get(f"{API}/auth/me", headers=alice).json()["user"] is None


def test_me_says_whether_the_site_is_read_only(anonymous: TestClient, read_only: None) -> None:
    assert anonymous.get(f"{API}/auth/me").json()["read_only"] is True


@pytest.mark.parametrize(
    ("method", "path", "allowed"),
    [
        ("GET", "/api/v1/projects", True),
        ("HEAD", "/api/v1/projects", True),
        ("OPTIONS", "/api/v1/projects", True),
        ("POST", "/api/v1/auth/logout", True),
        ("DELETE", "/api/v1/auth/me/tokens/abc", True),
        ("POST", "/api/v1/projects/P1/studies/S1/import", True),
        ("POST", "/api/v1/projects", False),
        ("DELETE", "/api/v1/auth/me/tokens", False),
        ("POST", "/api/v1/auth/me/tokens", False),
        ("POST", "/api/v1/projects/P1/studies/S1/import/more", False),
        ("PATCH", "/api/v1/auth/logout", False),
    ],
)
def test_which_requests_are_allowed_while_read_only(method: str, path: str, allowed: bool) -> None:
    assert allowed_while_read_only(method, path) is allowed
