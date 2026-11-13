from __future__ import annotations

# ruff: noqa: I001

from collections.abc import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings


class Base(DeclarativeBase):
    pass


from app.services.auth.models import RefreshSession  # noqa: E402,F401
from app.services.users.models import User  # noqa: E402,F401
from app.services.workspaces.models import (  # noqa: E402,F401
    Workspace,
    WorkspaceInvitation,
    WorkspaceMember,
)

database_url = settings.database_url
engine = create_async_engine(
    database_url,
    pool_pre_ping=True,
    pool_size=settings.postgres_pool_size,
    max_overflow=settings.postgres_max_overflow,
    pool_timeout=settings.postgres_pool_timeout,
    future=True,
)

async_session_factory = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        yield session


async def check_database_connection() -> bool:
    async with async_session_factory() as session:
        try:
            await session.execute(text("SELECT 1"))
            return True
        except Exception:
            return False
