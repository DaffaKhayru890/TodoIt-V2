from __future__ import annotations

from app.core.config import settings


def test_settings_defaults() -> None:
    assert settings.app_env in {"development", "test", "staging", "production"}
    assert settings.database_url.startswith("postgresql+asyncpg://")
    assert settings.app_name
