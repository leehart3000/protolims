"""Application settings, read from environment variables."""

from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Settings for the API.

    Each field can be overridden by an environment variable with the
    PROTOLIMS_ prefix, e.g. PROTOLIMS_DATABASE_URL.
    """

    model_config = SettingsConfigDict(env_prefix="PROTOLIMS_", extra="ignore")

    # Default points at the local Docker Compose database (development only).
    database_url: str = "postgresql+psycopg://protolims:protolims_dev@127.0.0.1:5433/protolims"

    @field_validator("database_url")
    @classmethod
    def use_psycopg_driver(cls, value: str) -> str:
        """Accept plain postgresql:// addresses (as Neon provides) and use psycopg."""
        for prefix in ("postgresql://", "postgres://"):
            if value.startswith(prefix):
                return "postgresql+psycopg://" + value.removeprefix(prefix)
        return value


@lru_cache
def get_settings() -> Settings:
    """Return the settings, created once and then reused."""
    return Settings()
