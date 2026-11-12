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
    jwt_issuer: str = Field(default="todo-list-api", alias="JWT_ISSUER")
    jwt_audience: str = Field(default="todo-list-client", alias="JWT_AUDIENCE")
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    jwt_access_token_expire_minutes: int = Field(
        default=15,
        alias="JWT_ACCESS_TOKEN_EXPIRE_MINUTES",
    )
    jwt_refresh_token_expire_days: int = Field(
        default=7,
        alias="JWT_REFRESH_TOKEN_EXPIRE_DAYS",
    )

    refresh_cookie_name: str = Field(default="refresh_token", alias="REFRESH_COOKIE_NAME")
    refresh_cookie_secure: bool = Field(default=False, alias="REFRESH_COOKIE_SECURE")
    refresh_cookie_httponly: bool = Field(default=True, alias="REFRESH_COOKIE_HTTPONLY")
    refresh_cookie_samesite: str = Field(default="lax", alias="REFRESH_COOKIE_SAMESITE")
    refresh_cookie_path: str = Field(default="/api/v1/auth", alias="REFRESH_COOKIE_PATH")
    refresh_cookie_domain: str | None = Field(default=None, alias="REFRESH_COOKIE_DOMAIN")

    csrf_cookie_name: str = Field(default="csrf_token", alias="CSRF_COOKIE_NAME")
    csrf_header_name: str = Field(default="X-CSRF-Token", alias="CSRF_HEADER_NAME")
    csrf_cookie_secure: bool = Field(default=False, alias="CSRF_COOKIE_SECURE")
    csrf_cookie_samesite: str = Field(default="lax", alias="CSRF_COOKIE_SAMESITE")
    csrf_cookie_httponly: bool = Field(default=False, alias="CSRF_COOKIE_HTTPONLY")

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

        allowed_algorithms = {"HS256", "HS384", "HS512"}
        if self.jwt_algorithm not in allowed_algorithms:
            raise ValueError("JWT_ALGORITHM must be one of HS256, HS384, or HS512")
        if self.jwt_access_token_expire_minutes <= 0:
            raise ValueError("JWT_ACCESS_TOKEN_EXPIRE_MINUTES must be positive")
        if self.jwt_refresh_token_expire_days <= 0:
            raise ValueError("JWT_REFRESH_TOKEN_EXPIRE_DAYS must be positive")
        if self.jwt_refresh_token_expire_days <= self.jwt_access_token_expire_minutes / (60 * 24):
            raise ValueError("JWT refresh expiration must be greater than access expiration")
        if self.refresh_cookie_samesite.lower() == "none" and not self.refresh_cookie_secure:
            raise ValueError("Refresh cookie secure flag must be true when SameSite=None")
        if self.csrf_cookie_samesite.lower() == "none" and not self.csrf_cookie_secure:
            raise ValueError("CSRF cookie secure flag must be true when SameSite=None")

        if self.app_env == "production":
            production_secret_values = {
                "change-me",
                "replace-with-strong-production-secret",
            }
            production_db_passwords = {"postgres", "change-me"}
            if not jwt_secret or jwt_secret in production_secret_values:
                raise ValueError("JWT_SECRET_KEY must be set in production")
            if not postgres_password or postgres_password in production_db_passwords:
                raise ValueError("POSTGRES_PASSWORD must be set in production")
            if not self.refresh_cookie_secure:
                raise ValueError("REFRESH_COOKIE_SECURE must be true in production")
            if not self.csrf_cookie_secure:
                raise ValueError("CSRF_COOKIE_SECURE must be true in production")
            if self.refresh_cookie_httponly is not True:
                raise ValueError("REFRESH_COOKIE_HTTPONLY must be true in production")

        if self.app_env == "test" and self.postgres_db == "todoit_db":
            self.postgres_db = "todoit_test_db"


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.validate_configuration()
    return settings


settings = get_settings()
