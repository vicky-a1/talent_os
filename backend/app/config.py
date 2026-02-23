from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


def _load_env_file(path: Path) -> None:
    if not path.exists() or not path.is_file():
        return

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip("'").strip('"')

        if not key:
            continue

        existing = os.environ.get(key)
        if existing is None or existing == "":
            os.environ[key] = value


def _get_env(name: str, default: str | None = None) -> str | None:
    value = os.getenv(name)
    if value is None:
        return default
    return value


def _get_env_list(name: str, default: list[str]) -> list[str]:
    raw = os.getenv(name)
    if raw is None:
        return default
    items = [item.strip() for item in raw.split(",")]
    return [item for item in items if item]


def _get_env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


@dataclass(frozen=True)
class Settings:
    app_name: str
    env: str
    api_v1_prefix: str
    database_url: str
    cors_allow_origins: list[str]
    log_level: str
    request_id_header: str
    rate_limit_per_minute: int


def get_settings() -> Settings:
    base_dir = Path(__file__).resolve().parents[1]
    _load_env_file(base_dir / ".env")

    return Settings(
        app_name=_get_env("APP_NAME", "Nefera AI") or "Nefera AI",
        env=_get_env("ENV", "development") or "development",
        api_v1_prefix=_get_env("API_V1_PREFIX", "/api/v1") or "/api/v1",
        database_url=_get_env(
            "DATABASE_URL",
            "postgresql+psycopg://postgres:postgres@localhost:5432/nefera_ai",
        )
        or "postgresql+psycopg://postgres:postgres@localhost:5432/nefera_ai",
        cors_allow_origins=_get_env_list(
            "CORS_ALLOW_ORIGINS",
            ["http://localhost:3000"],
        ),
        log_level=_get_env("LOG_LEVEL", "INFO") or "INFO",
        request_id_header=_get_env("REQUEST_ID_HEADER", "X-Request-ID") or "X-Request-ID",
        rate_limit_per_minute=_get_env_int("RATE_LIMIT_PER_MINUTE", 60),
    )


settings = get_settings()
