"""Tests for signing in with ORCID, using a fake ORCID that signs ID tokens with a test key."""

import time
from collections.abc import Callable
from typing import Any
from urllib.parse import parse_qs, urlsplit

import httpx
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient
from jwt.algorithms import RSAAlgorithm
from sqlalchemy import Engine, text

from protolims_api.config import Settings
from protolims_api.routers import auth

AUTH = "/api/v1/auth"
ORCID = "https://orcid.example"
ORCID_ID = "0000-0002-1825-0097"
KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
JWKS = {
    "keys": [
        {
            **RSAAlgorithm.to_jwk(KEY.public_key(), as_dict=True),
            "kid": "test-key",
            "use": "sig",
        }
    ]
}


@pytest.fixture
def client(anonymous: TestClient) -> TestClient:
    """These tests sign in and out for themselves, so they start as nobody."""
    return anonymous


def id_token(nonce: str, kid: str = "test-key", **claims: Any) -> str:
    """An ID token like ORCID's, signed with the test key."""
    now = int(time.time())
    payload = {
        "iss": ORCID,
        "aud": "APP-TEST",
        "sub": ORCID_ID,
        "iat": now,
        "exp": now + 600,
        "nonce": nonce,
        "given_name": "Josiah",
        "family_name": "Carberry",
        **claims,
    }
    return jwt.encode(payload, KEY, algorithm="RS256", headers={"kid": kid})


def fake_orcid(
    monkeypatch: pytest.MonkeyPatch,
    token_reply: Callable[[], httpx.Response],
    jwks: dict[str, Any] = JWKS,
) -> list[httpx.Request]:
    """Answer the API's requests to ORCID; return them, so tests can check what was sent."""
    requests: list[httpx.Request] = []

    def handle(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        if request.url.path == "/oauth/jwks":
            return httpx.Response(200, json=jwks)
        return token_reply()

    monkeypatch.setattr(auth, "transport", httpx.MockTransport(handle))
    return requests


def start_sign_in(client: TestClient, return_to: str = "/projects") -> dict[str, str]:
    """Start signing in, as a new browser; return what was sent to ORCID."""
    client.cookies.clear()
    response = client.get(
        f"{AUTH}/orcid/login", params={"return_to": return_to}, follow_redirects=False
    )
    assert response.status_code == 302
    location = urlsplit(response.headers["location"])
    assert f"{location.scheme}://{location.netloc}{location.path}" == f"{ORCID}/oauth/authorize"
    return {name: values[0] for name, values in parse_qs(location.query).items()}


def come_back(client: TestClient, sent: dict[str, str], **params: str) -> Any:
    """ORCID sending the browser back, by default with a code."""
    return client.get(
        f"{AUTH}/orcid/callback",
        params={"state": sent["state"], "code": "the-code", **params},
        follow_redirects=False,
    )


def sign_in(
    client: TestClient, monkeypatch: pytest.MonkeyPatch, **claims: Any
) -> tuple[Any, list[httpx.Request]]:
    """Sign in all the way, with ORCID vouching for the given claims."""
    sent = start_sign_in(client)
    requests = fake_orcid(
        monkeypatch,
        lambda: httpx.Response(200, json={"id_token": id_token(sent["nonce"], **claims)}),
    )
    return come_back(client, sent), requests


def me(client: TestClient) -> Any:
    return client.get(f"{AUTH}/me").json()["user"]


def count(database: Engine, table: str) -> int:
    with database.connect() as conn:
        return int(conn.execute(text(f"SELECT count(*) FROM {table}")).scalar_one())


def test_signing_in_with_orcid(
    client: TestClient, monkeypatch: pytest.MonkeyPatch, database: Engine
) -> None:
    sent = start_sign_in(client)
    assert {name: sent[name] for name in ("client_id", "response_type", "scope")} == {
        "client_id": "APP-TEST",
        "response_type": "code",
        "scope": "openid",
    }
    assert sent["redirect_uri"] == "http://127.0.0.1:5173/api/v1/auth/orcid/callback"
    assert me(client) is None

    requests = fake_orcid(
        monkeypatch, lambda: httpx.Response(200, json={"id_token": id_token(sent["nonce"])})
    )
    response = come_back(client, sent)

    assert response.status_code == 302
    assert response.headers["location"] == "/projects"
    cookies = response.headers.get_list("set-cookie")
    session_cookie = next(c for c in cookies if c.startswith("protolims_session="))
    assert "HttpOnly" in session_cookie
    assert "SameSite=lax" in session_cookie
    assert any(c.startswith("protolims_sign_in=") for c in cookies)
    assert me(client) | {"id": None} == {
        "id": None,
        "provider": "orcid",
        "subject": ORCID_ID,
        "name": "Josiah Carberry",
    }

    token_request = parse_qs(requests[0].content.decode())
    assert {name: values[0] for name, values in token_request.items()} == {
        "client_id": "APP-TEST",
        "client_secret": "test-secret",
        "grant_type": "authorization_code",
        "code": "the-code",
        "redirect_uri": "http://127.0.0.1:5173/api/v1/auth/orcid/callback",
    }
    with database.connect() as conn:
        stored = conn.execute(text("SELECT token_hash FROM user_session")).scalar_one()
    assert stored not in session_cookie
    assert count(database, "sign_in_attempt") == 0


def test_signing_in_again_keeps_the_same_user_and_updates_their_name(
    client: TestClient, monkeypatch: pytest.MonkeyPatch, database: Engine
) -> None:
    sign_in(client, monkeypatch)
    first = me(client)
    sign_in(client, monkeypatch, given_name="Jo", family_name=None)

    assert me(client) == first | {"name": "Jo"}
    assert (count(database, "app_user"), count(database, "user_session")) == (1, 2)


def test_a_sign_in_only_goes_back_to_a_page_on_this_site() -> None:
    for unsafe in [None, "", "projects", "https://evil.example/", "//evil.example", "/\\evil"]:
        assert auth.safe_return_to(unsafe) == "/", unsafe
    assert auth.safe_return_to("/studies?project=P1") == "/studies?project=P1"


def test_a_sign_in_must_come_back_to_the_browser_that_started_it(
    client: TestClient, database: Engine
) -> None:
    sent = start_sign_in(client)
    assert come_back(client, sent, state="made-up").status_code == 400

    client.cookies.clear()
    assert come_back(client, sent).status_code == 400

    sent = start_sign_in(client)
    with database.begin() as conn:
        conn.execute(text("DELETE FROM sign_in_attempt"))
    assert come_back(client, sent).status_code == 400

    sent = start_sign_in(client)
    with database.begin() as conn:
        conn.execute(text("UPDATE sign_in_attempt SET created_at = now() - interval '11 minutes'"))
    response = come_back(client, sent)
    assert response.status_code == 400
    assert "expired" in response.json()["detail"]


def test_cancelling_at_orcid_signs_nobody_in(client: TestClient, database: Engine) -> None:
    sent = start_sign_in(client, return_to="/studies")
    response = come_back(client, sent, error="access_denied")

    assert (response.status_code, response.headers["location"]) == (302, "/studies")
    assert me(client) is None
    assert count(database, "sign_in_attempt") == 0


@pytest.mark.parametrize(
    ("reply", "expected"),
    [
        (lambda nonce: httpx.Response(400, json={"error": "invalid_grant"}), 502),
        (lambda nonce: httpx.Response(200, json={"access_token": "no ID token"}), 502),
        (lambda nonce: httpx.Response(200, json={"id_token": id_token("wrong")}), 400),
        (lambda nonce: httpx.Response(200, json={"id_token": id_token(nonce, aud="APP-X")}), 400),
        (
            lambda nonce: httpx.Response(200, json={"id_token": id_token(nonce, iss=ORCID + "x")}),
            400,
        ),
        (lambda nonce: httpx.Response(200, json={"id_token": id_token(nonce, kid="other")}), 400),
        (lambda nonce: httpx.Response(200, json={"id_token": "not a token"}), 400),
    ],
)
def test_a_sign_in_is_refused_unless_orcids_reply_checks_out(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    reply: Callable[[str], httpx.Response],
    expected: int,
) -> None:
    sent = start_sign_in(client)
    fake_orcid(monkeypatch, lambda: reply(sent["nonce"]))

    assert come_back(client, sent).status_code == expected
    assert me(client) is None


def test_a_sign_in_is_refused_if_orcids_keys_cant_be_read(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    sent = start_sign_in(client)
    fake_orcid(
        monkeypatch,
        lambda: httpx.Response(200, json={"id_token": id_token(sent["nonce"])}),
        jwks={"keys": []},
    )

    assert come_back(client, sent).status_code == 400


def test_signing_out_ends_the_session(
    client: TestClient, monkeypatch: pytest.MonkeyPatch, database: Engine
) -> None:
    sign_in(client, monkeypatch)
    assert me(client) is not None

    response = client.post(f"{AUTH}/logout")
    assert response.status_code == 204
    assert me(client) is None
    assert count(database, "user_session") == 0
    assert client.post(f"{AUTH}/logout").status_code == 204


def test_an_expired_session_signs_nobody_in(
    client: TestClient, monkeypatch: pytest.MonkeyPatch, database: Engine
) -> None:
    sign_in(client, monkeypatch)
    with database.begin() as conn:
        conn.execute(text("UPDATE user_session SET expires_at = now() - interval '1 minute'"))

    assert me(client) is None


def test_sign_in_is_refused_when_orcid_is_not_set_up(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    unset = Settings(orcid_client_id=None, orcid_client_secret=None)
    monkeypatch.setattr(auth, "get_settings", lambda: unset)

    response = client.get(f"{AUTH}/orcid/login", follow_redirects=False)
    assert response.status_code == 503
