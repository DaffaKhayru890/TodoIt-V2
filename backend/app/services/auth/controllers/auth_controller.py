from __future__ import annotations

from uuid import UUID

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.auth.service import AuthService
from app.services.users.models import User


class AuthController:
    @staticmethod
    async def register(
        session: AsyncSession,
        *,
        email: str,
        password: str,
        full_name: str,
        timezone: str | None,
    ) -> User:
        return await AuthService.register(
            session,
            email=email,
            password=password,
            full_name=full_name,
            timezone=timezone,
        )

    @staticmethod
    async def login(
        session: AsyncSession,
        *,
        email: str,
        password: str,
    ) -> tuple[str, str, str, User]:
        return await AuthService.login(session, email=email, password=password)

    @staticmethod
    async def refresh(
        session: AsyncSession,
        *,
        refresh_token: str,
        csrf_token: str | None,
        request: Request | None = None,
    ) -> tuple[str, str, User]:
        return await AuthService.refresh(
            session,
            refresh_token=refresh_token,
            csrf_token=csrf_token,
            request=request,
        )

    @staticmethod
    async def logout(session: AsyncSession, *, refresh_token: str | None) -> None:
        await AuthService.logout(session, refresh_token=refresh_token)

    @staticmethod
    async def logout_all(session: AsyncSession, *, user_id: UUID) -> None:
        await AuthService.logout_all(session, user_id=user_id)

    @staticmethod
    async def me(session: AsyncSession, *, user_id: UUID) -> User | None:
        return await AuthService.get_current_user(session, user_id=user_id)
