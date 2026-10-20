"""Shared test fixtures."""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from protolims_api.main import app


@pytest.fixture(scope="session")
def client() -> Iterator[TestClient]:
    """One test client for the whole test run."""
    with TestClient(app) as test_client:
        yield test_client
