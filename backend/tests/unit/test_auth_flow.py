from __future__ import annotations

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.services.auth.security import hash_password, verify_password
from app.services.auth.service import AuthService
from app.services.users.service import UserService


@pytest.mark.asyncio
async def test_password_hash_and_verification() -> None:
    raw = "secure-password-123"
    hashed = hash_password(raw)
    assert hashed != raw
    assert verify_password(raw, hashed) is True
    assert verify_password("different-pass", hashed) is False


@pytest.mark.asyncio
async def test_register_and_login_flow() -> None:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        user = await UserService.create_user(
            session,
            email="User@Example.com",
            password="secure-password-123",
            full_name="Jane Doe",
        )
        await session.commit()
        assert user.email == "user@example.com"

        access_token, refresh_token, csrf_token, logged_in_user = await AuthService.login(
            session,
            email="user@example.com",
            password="secure-password-123",
        )
        await session.commit()

        assert access_token.startswith("eyJ")
        assert refresh_token.startswith("eyJ")
        assert logged_in_user.email == "user@example.com"
        assert csrf_token

    await engine.dispose()
