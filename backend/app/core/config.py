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
    pagination_cursor_secret: SecretStr = Field(
        default=SecretStr("dev-cursor-secret"), alias="PAGINATION_CURSOR_SECRET"
    )
    default_upcoming_days: int = Field(default=7, alias="DEFAULT_UPCOMING_DAYS")
    max_upcoming_days: int = Field(default=30, alias="MAX_UPCOMING_DAYS")
    todo_default_limit: int = Field(default=20, alias="TODO_DEFAULT_LIMIT")
    todo_max_limit: int = Field(default=100, alias="TODO_MAX_LIMIT")
    automatic_due_reminders_enabled: bool = Field(
        default=True, alias="AUTOMATIC_DUE_REMINDERS_ENABLED"
    )
    default_due_reminder_minutes: int = Field(
        default=60, ge=1, le=10080, alias="DEFAULT_DUE_REMINDER_MINUTES"
    )
    notification_worker_enabled: bool = Field(default=True, alias="NOTIFICATION_WORKER_ENABLED")
    notification_poll_interval_seconds: int = Field(
        default=30, ge=1, le=3600, alias="NOTIFICATION_POLL_INTERVAL_SECONDS"
    )
    notification_batch_size: int = Field(
        default=100, ge=1, le=1000, alias="NOTIFICATION_BATCH_SIZE"
    )
    notification_worker_shutdown_timeout_seconds: int = Field(
        default=15,
        ge=1,
        le=120,
        alias="NOTIFICATION_WORKER_SHUTDOWN_TIMEOUT_SECONDS",
    )
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

        if self.default_upcoming_days < 1 or self.max_upcoming_days < self.default_upcoming_days:
            raise ValueError("DEFAULT_UPCOMING_DAYS and MAX_UPCOMING_DAYS must be valid")
        if self.todo_default_limit <= 0 or self.todo_max_limit < self.todo_default_limit:
            raise ValueError("TODO_DEFAULT_LIMIT and TODO_MAX_LIMIT must be valid")
        if self.default_due_reminder_minutes <= 0:
            raise ValueError("DEFAULT_DUE_REMINDER_MINUTES must be positive")
        if self.notification_poll_interval_seconds <= 0:
            raise ValueError("NOTIFICATION_POLL_INTERVAL_SECONDS must be positive")
        if self.notification_batch_size < 1 or self.notification_batch_size > 1000:
            raise ValueError("NOTIFICATION_BATCH_SIZE must be between 1 and 1000")
        if self.notification_worker_shutdown_timeout_seconds <= 0:
            raise ValueError("NOTIFICATION_WORKER_SHUTDOWN_TIMEOUT_SECONDS must be positive")
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
            if (
                not self.pagination_cursor_secret.get_secret_value()
                or self.pagination_cursor_secret.get_secret_value() == "dev-cursor-secret"
            ):
                raise ValueError("PAGINATION_CURSOR_SECRET must be set in production")

        if self.app_env == "test" and self.postgres_db == "todoit_db":
            self.postgres_db = "todoit_test_db"


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.validate_configuration()
    return settings


settings = get_settings()
