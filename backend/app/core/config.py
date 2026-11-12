from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL

AppEnvironment = Literal["development", "test", "staging", "production"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_env: AppEnvironment = Field(default="development", alias="APP_ENV")
    app_name: str = Field(default="TodoIt V2 API", alias="APP_NAME")
    app_debug: bool = Field(default=False, alias="APP_DEBUG")
    app_host: str = Field(default="0.0.0.0", alias="APP_HOST")
    app_port: int = Field(default=8000, alias="APP_PORT")
    api_v1_prefix: str = Field(default="/api/v1", alias="API_V1_PREFIX")
    default_timezone: str = Field(default="UTC", alias="DEFAULT_TIMEZONE")
    openapi_enabled: bool = Field(default=True, alias="OPENAPI_ENABLED")

    postgres_host: str = Field(default="localhost", alias="POSTGRES_HOST")
    postgres_port: int = Field(default=5432, alias="POSTGRES_PORT")
    postgres_db: str = Field(default="todoit_db", alias="POSTGRES_DB")
    postgres_user: str = Field(default="postgres", alias="POSTGRES_USER")
    postgres_password: SecretStr = Field(default=SecretStr("postgres"), alias="POSTGRES_PASSWORD")
    postgres_pool_size: int = Field(default=5, alias="POSTGRES_POOL_SIZE")
    postgres_max_overflow: int = Field(default=10, alias="POSTGRES_MAX_OVERFLOW")
    postgres_pool_timeout: int = Field(default=30, alias="POSTGRES_POOL_TIMEOUT")

    cors_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:3000"],
        alias="CORS_ORIGINS",
    )
    cors_allow_credentials: bool = Field(default=True, alias="CORS_ALLOW_CREDENTIALS")

    jwt_secret_key: SecretStr = Field(
        default=SecretStr("change-me"),
        alias="JWT_SECRET_KEY",
    )
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    jwt_access_token_expire_minutes: int = Field(
        default=15,
        alias="JWT_ACCESS_TOKEN_EXPIRE_MINUTES",
    )
    jwt_refresh_token_expire_days: int = Field(
        default=7,
        alias="JWT_REFRESH_TOKEN_EXPIRE_DAYS",
    )

    log_level: str = Field(default="INFO", alias="LOG_LEVEL")
    log_format: str = Field(default="console", alias="LOG_FORMAT")

    @property
    def database_url(self) -> str:
        return URL.create(
            drivername="postgresql+asyncpg",
            host=self.postgres_host,
            port=self.postgres_port,
            database=self.postgres_db,
            username=self.postgres_user,
            password=self.postgres_password.get_secret_value(),
        ).render_as_string(hide_password=False)

    def validate_configuration(self) -> None:
        jwt_secret = self.jwt_secret_key.get_secret_value()
        postgres_password = self.postgres_password.get_secret_value()

        if self.app_env == "production":
            if not jwt_secret or jwt_secret == "change-me":
                raise ValueError("JWT_SECRET_KEY must be set in production")
            if not postgres_password or postgres_password == "postgres":
                raise ValueError("POSTGRES_PASSWORD must be set in production")

        if self.app_env == "test" and self.postgres_db == "todoit_db":
            self.postgres_db = "todoit_test_db"


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.validate_configuration()
    return settings


settings = get_settings()
