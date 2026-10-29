"""Shared test fixtures.

Tests run against a separate database (protolims_test by default), which is
created and migrated automatically, and emptied before each test.
"""

import os
from collections.abc import Iterator
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import Engine, create_engine, make_url, text

from protolims_api.models import Base

TEST_DATABASE_URL = "postgresql+psycopg://protolims:protolims_dev@127.0.0.1:5433/protolims_test"

# Must be set before the app reads its settings.
os.environ.setdefault("PROTOLIMS_DATABASE_URL", TEST_DATABASE_URL)

# Tests sign in with a fake ORCID (see test_auth.py). These are set outright, rather than with
# setdefault, so a real client in backend/.env is never used by the tests.
os.environ["PROTOLIMS_PUBLIC_URL"] = "http://127.0.0.1:5173"
os.environ["PROTOLIMS_ORCID_BASE_URL"] = "https://orcid.example"
os.environ["PROTOLIMS_ORCID_CLIENT_ID"] = "APP-TEST"
os.environ["PROTOLIMS_ORCID_CLIENT_SECRET"] = "test-secret"

ALEMBIC_INI = Path(__file__).resolve().parent.parent / "alembic.ini"


def _create_database_if_missing(url: str) -> None:
    db_url = make_url(url)
    admin = create_engine(db_url.set(database="postgres"), isolation_level="AUTOCOMMIT")
    with admin.connect() as conn:
        exists = conn.execute(
            text("SELECT 1 FROM pg_database WHERE datname = :name"),
            {"name": db_url.database},
        ).scalar()
        if not exists:
            conn.execute(text(f'CREATE DATABASE "{db_url.database}"'))
    admin.dispose()


@pytest.fixture(scope="session", autouse=True)
def database() -> Iterator[Engine]:
    """Create and migrate the test database once per test run."""
    url = os.environ["PROTOLIMS_DATABASE_URL"]
    name = make_url(url).database or ""
    if not name.endswith("_test"):
        pytest.exit(f"Refusing to run tests against non-test database {name!r}")
    _create_database_if_missing(url)
    command.upgrade(Config(str(ALEMBIC_INI)), "head")
    engine = create_engine(url)
    yield engine
    engine.dispose()


@pytest.fixture(autouse=True)
def clean_tables(database: Engine) -> None:
    """Empty every table before each test, so tests can't affect each other."""
    tables = ", ".join(table.name for table in Base.metadata.sorted_tables)
    with database.begin() as conn:
        conn.execute(text(f"TRUNCATE {tables} CASCADE"))


@pytest.fixture(scope="session")
def client() -> Iterator[TestClient]:
    """One test client for the whole test run."""
    from protolims_api.main import app

    with TestClient(app) as test_client:
        yield test_client
