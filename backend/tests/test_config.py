"""Tests for application settings."""

from protolims_api.config import Settings


def test_plain_postgresql_url_uses_psycopg() -> None:
    settings = Settings(database_url="postgresql://u:p@host/db?sslmode=require")
    assert settings.database_url == "postgresql+psycopg://u:p@host/db?sslmode=require"


def test_postgres_shorthand_url_uses_psycopg() -> None:
    settings = Settings(database_url="postgres://u:p@host/db")
    assert settings.database_url == "postgresql+psycopg://u:p@host/db"


def test_explicit_driver_is_left_alone() -> None:
    url = "postgresql+psycopg://u:p@host/db"
    assert Settings(database_url=url).database_url == url
