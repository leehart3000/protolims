"""Shared test fixtures.

Tests run against a separate database (protolims_test by default), which is
created and migrated automatically, and emptied before each test.
"""

import hashlib
import os
import secrets
from collections.abc import Iterator
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from helpers import SITE_ADMIN, SignIn
from sqlalchemy import Engine, create_engine, make_url, text

from protolims_api.config import get_settings
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

# The tests' site administrator, and public reading on, as on protolims.org. Tests of a
# private instance use the private fixture.
os.environ["PROTOLIMS_SITE_ADMINS"] = SITE_ADMIN
os.environ["PROTOLIMS_PUBLIC_READ"] = "true"

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


def add_session(database: Engine, orcid_id: str, name: str | None = None) -> dict[str, str]:
    """Sign someone in, by ORCID iD, straight into the database (without going to ORCID).
    Returns the request headers for their browser."""
    token = secrets.token_urlsafe(16)
    with database.begin() as conn:
        user_id = conn.execute(
            text(
                "INSERT INTO app_user (provider, subject, name, last_signed_in_at)"
                " VALUES ('orcid', :subject, :name, now())"
                " ON CONFLICT (provider, subject) DO UPDATE SET name = EXCLUDED.name"
                " RETURNING id"
            ),
            {"subject": orcid_id, "name": name},
        ).scalar_one()
        conn.execute(
            text(
                "INSERT INTO user_session (token_hash, user_id, expires_at)"
                " VALUES (:token_hash, :user_id, now() + interval '1 day')"
            ),
            {"token_hash": hashlib.sha256(token.encode()).hexdigest(), "user_id": user_id},
        )
    return {"Cookie": f"protolims_session={token}"}


@pytest.fixture(scope="session")
def shared_client() -> Iterator[TestClient]:
    """One test client for the whole test run, used by the client fixture."""
    from protolims_api.main import app

    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def client(shared_client: TestClient, database: Engine, clean_tables: None) -> TestClient:
    """A test client signed in as the site administrator, who may do anything, so that tests
    can create and change records. Tests of who may do what use sign_in_as and anonymous."""
    shared_client.cookies.clear()
    shared_client.headers.update(add_session(database, SITE_ADMIN))
    return shared_client


@pytest.fixture(scope="session")
def anonymous() -> Iterator[TestClient]:
    """A test client that isn't signed in."""
    from protolims_api.main import app

    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def sign_in_as(database: Engine, clean_tables: None) -> SignIn:
    """Sign someone in, by ORCID iD, without going to ORCID. Returns the request headers for
    their browser: pass them as headers=... on each request made as them."""

    def sign_in(orcid_id: str, name: str | None = None) -> dict[str, str]:
        return add_session(database, orcid_id, name)

    return sign_in


@pytest.fixture
def private(monkeypatch: pytest.MonkeyPatch) -> None:
    """Public reading off for this test, as on a private instance."""
    monkeypatch.setattr(get_settings(), "public_read", False)
