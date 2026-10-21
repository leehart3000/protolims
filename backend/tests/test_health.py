"""Tests for the health check endpoints."""

from collections.abc import AsyncIterator
from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy.exc import SQLAlchemyError

from protolims_api.db import get_session
from protolims_api.main import app


def test_health_returns_ok(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_health_db_returns_ok(client: TestClient) -> None:
    response = client.get("/health/db")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}


class _BrokenSession:
    """Pretends to be a database session whose database is down."""

    async def execute(self, *args: Any, **kwargs: Any) -> None:
        raise SQLAlchemyError("database is down")


async def _broken_session() -> AsyncIterator[_BrokenSession]:
    yield _BrokenSession()


def test_health_db_reports_unavailable(client: TestClient) -> None:
    app.dependency_overrides[get_session] = _broken_session
    try:
        response = client.get("/health/db")
    finally:
        app.dependency_overrides.clear()
    assert response.status_code == 503
    assert response.json() == {"detail": "Database unavailable"}
