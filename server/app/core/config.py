from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

SERVER_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    """Application settings — values come from `server/.env` (or process env)."""

    model_config = SettingsConfigDict(
        env_file=SERVER_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str
    app_version: str
    api_v1_prefix: str
    debug: bool

    database_url: str
    cors_origins: str

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
