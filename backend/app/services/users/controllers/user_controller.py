from __future__ import annotations

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.users.models import User
from app.services.users.service import UserService


class UserController:
    @staticmethod
    async def get_profile(session: AsyncSession, user_id: UUID) -> User | None:
        return await UserService.get_profile(session, user_id)
