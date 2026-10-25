"""Tests for the proxy key, which makes requests go through the website's Worker."""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from protolims_api.config import Settings, get_settings
from protolims_api.main import PROXY_KEY_HEADER

KEY = "test-proxy-key"


@pytest.fixture
def proxy_key(monkeypatch: pytest.MonkeyPatch) -> Iterator[str]:
    """Set a proxy key for one test."""
    monkeypatch.setenv("PROTOLIMS_PROXY_KEY", KEY)
    get_settings.cache_clear()
    yield KEY
    get_settings.cache_clear()


def test_requests_need_the_proxy_key_when_one_is_set(client: TestClient, proxy_key: str) -> None:
    assert client.get("/api/v1/projects").status_code == 403
    assert client.get("/api/v1/projects", headers={PROXY_KEY_HEADER: "wrong"}).status_code == 403
    assert client.get("/api/v1/projects", headers={PROXY_KEY_HEADER: proxy_key}).status_code == 200


@pytest.mark.usefixtures("proxy_key")
def test_health_checks_do_not_need_the_proxy_key(client: TestClient) -> None:
    assert client.get("/health").status_code == 200
    assert client.get("/health/db").status_code == 200


def test_cloud_run_services_must_have_a_proxy_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("K_SERVICE", "protolims-api-staging")
    monkeypatch.delenv("PROTOLIMS_PROXY_KEY", raising=False)
    with pytest.raises(ValidationError, match="PROTOLIMS_PROXY_KEY"):
        Settings()

    monkeypatch.setenv("PROTOLIMS_PROXY_KEY", KEY)
    assert Settings().proxy_key is not None
