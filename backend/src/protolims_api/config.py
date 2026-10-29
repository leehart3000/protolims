"""Application settings, read from environment variables."""

from functools import lru_cache
from typing import Self

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Settings for the API.

    Each field can be overridden by an environment variable with the
    PROTOLIMS_ prefix, e.g. PROTOLIMS_DATABASE_URL.
    """

    # Locally, settings can also come from backend/.env, which git ignores (for secrets such
    # as the ORCID sandbox client's). Environment variables win over the file.
    model_config = SettingsConfigDict(env_prefix="PROTOLIMS_", env_file=".env", extra="ignore")

    # Default points at the local Docker Compose database (development only).
    database_url: str = "postgresql+psycopg://protolims:protolims_dev@127.0.0.1:5433/protolims"

    # The key the website's Worker sends with each request (PROTOLIMS_PROXY_KEY). When it's
    # set, requests without it are refused, so the API can't be used directly on Cloud Run.
    proxy_key: SecretStr | None = None

    # The website's address, as people see it. Sign-in sends people back here, and cookies are
    # marked Secure when it starts with https://. Locally, open the site at this address.
    public_url: str = "http://127.0.0.1:5173"

    # Signing in with ORCID. Locally, the ORCID sandbox; on staging and production,
    # https://orcid.org. Sign-in is off until a client ID and secret are set.
    orcid_base_url: str = "https://sandbox.orcid.org"
    orcid_client_id: str | None = None
    orcid_client_secret: SecretStr | None = None

    # How long someone stays signed in.
    session_days: int = Field(default=14, ge=1, le=90)

    # Cloud Run sets K_SERVICE on its services (not on jobs, such as migrations).
    cloud_run_service: str | None = Field(default=None, validation_alias="K_SERVICE")

    @field_validator("database_url")
    @classmethod
    def use_psycopg_driver(cls, value: str) -> str:
        """Accept plain postgresql:// addresses (as Neon provides) and use psycopg."""
        for prefix in ("postgresql://", "postgres://"):
            if value.startswith(prefix):
                return "postgresql+psycopg://" + value.removeprefix(prefix)
        return value

    @model_validator(mode="after")
    def require_proxy_key_on_cloud_run(self) -> Self:
        """Refuse to start on Cloud Run without a proxy key, rather than run unprotected."""
        if self.cloud_run_service and self.proxy_key is None:
            raise ValueError("PROTOLIMS_PROXY_KEY must be set when running on Cloud Run")
        return self


@lru_cache
def get_settings() -> Settings:
    """Return the settings, created once and then reused."""
    return Settings()
