from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT / ".env", extra="ignore")

    database_url: str = "postgresql+psycopg://retain:retain@localhost:5433/retain"
    ip_hash_salt: str = "dev-only-salt"
    cors_origins: list[str] = ["http://localhost:3000"]
    models_dir: Path = ROOT / "models"


@lru_cache
def get_settings() -> Settings:
    return Settings()
