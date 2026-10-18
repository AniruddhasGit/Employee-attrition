import json
from functools import lru_cache
from pathlib import Path
from typing import Annotated

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT / ".env", extra="ignore")

    database_url: str = "postgresql+psycopg://retain:retain@localhost:5433/retain"
    ip_hash_salt: str = "dev-only-salt"
    models_dir: Path = ROOT / "models"
    # Origins allowed to send state-changing requests (CSRF check) - the web app's own origin.
    site_origins: Annotated[list[str], NoDecode] = ["http://localhost:3000"]
    # Shared with the web proxy so the API can trust the client IP it forwards.
    proxy_secret: str = ""
    cookie_secure: bool = False
    session_ttl_hours: int = 12
    demo_password: str = "retain-demo"

    @field_validator("site_origins", mode="before")
    @classmethod
    def _split_origins(cls, value):
        """Accept a JSON list or a comma-separated string; trailing slashes never match Origin."""
        if isinstance(value, str):
            value = json.loads(value) if value.strip().startswith("[") else value.split(",")
        return [v.strip().rstrip("/") for v in value if v.strip()]

    @field_validator("database_url")
    @classmethod
    def _use_psycopg(cls, url: str) -> str:
        """Hosted Postgres (Neon, Render, RDS) hands out postgres:// URLs; we ship psycopg 3."""
        for prefix in ("postgresql://", "postgres://"):
            if url.startswith(prefix):
                return "postgresql+psycopg://" + url[len(prefix):]
        return url


@lru_cache
def get_settings() -> Settings:
    return Settings()
