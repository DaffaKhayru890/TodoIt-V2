from __future__ import annotations

import asyncio
import os
from collections.abc import AsyncGenerator
from datetime import UTC, datetime, timedelta

# Configure the application before importing modules that instantiate Settings
# and the global engine.
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("APP_DEBUG", "false")
os.environ.setdefault("POSTGRES_HOST", "localhost")
os.environ.setdefault("POSTGRES_PORT", "5432")
os.environ.setdefault("POSTGRES_DB", "todoit_phase5_test")
os.environ.setdefault("POSTGRES_USER", "root")
os.environ.setdefault("POSTGRES_PASSWORD", "dev@123")
os.environ.setdefault("PAGINATION_CURSOR_SECRET", "test-cursor-secret")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key")
os.environ.setdefault("NOTIFICATION_WORKER_ENABLED", "true")

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.core.database import Base, get_db_session
from app.main import create_app
from app.services.auth.dependencies import get_current_user

TEST_DATABASE_URL = settings.database_url
ADMIN_DATABASE_URL = TEST_DATABASE_URL.rsplit("/", 1)[0] + "/postgres"


async def _create_database_if_missing() -> None:
    admin_engine = create_async_engine(ADMIN_DATABASE_URL, isolation_level="AUTOCOMMIT")
    async with admin_engine.connect() as connection:
        exists = await connection.scalar(
            text("SELECT 1 FROM pg_database WHERE datname = :name"),
            {"name": settings.postgres_db},
        )
        if not exists:
            await connection.execute(text(f'CREATE DATABASE "{settings.postgres_db}"'))
    await admin_engine.dispose()


async def _reset_schema() -> None:
    engine = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.drop_all)
        await connection.run_sync(Base.metadata.create_all)
    await engine.dispose()


@pytest.fixture(scope="session", autouse=True)
def prepare_database() -> None:
    asyncio.run(_create_database_if_missing())
    asyncio.run(_reset_schema())


@pytest_asyncio.fixture
async def db_engine() -> AsyncGenerator:
    engine = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool)
    async with engine.begin() as connection:
        await connection.execute(
            text(
                "TRUNCATE TABLE notifications, reminders, todo_tags, todo_labels, "
                "todos, tags, labels, workspace_invitations, workspace_members, "
                "workspaces, refresh_sessions, users RESTART IDENTITY CASCADE"
            )
        )
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def session_factory(db_engine) -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(
        bind=db_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=False,
    )


@pytest_asyncio.fixture
async def db_session(session_factory) -> AsyncGenerator[AsyncSession, None]:
    async with session_factory() as session:
        yield session


@pytest.fixture
def client() -> TestClient:
    app = create_app()
    with TestClient(app) as test_client:
        yield test_client


@pytest_asyncio.fixture
async def api_app(session_factory):
    app = create_app()

    async def override_db_session() -> AsyncGenerator[AsyncSession, None]:
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db_session] = override_db_session
    yield app
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def api_client(api_app) -> AsyncGenerator[AsyncClient, None]:
    transport = ASGITransport(app=api_app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client


def authenticate(api_app, user) -> None:
    api_app.dependency_overrides[get_current_user] = lambda: user


@pytest.fixture
def fixed_now() -> datetime:
    return datetime(2026, 11, 13, 10, 0, tzinfo=UTC)


@pytest.fixture
def clock(fixed_now):
    return lambda: fixed_now


@pytest.fixture
def future_time(fixed_now) -> datetime:
    return fixed_now + timedelta(hours=2)
