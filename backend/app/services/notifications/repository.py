from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.notifications.models import Notification


class NotificationRepository:
    @staticmethod
    async def get_by_id(session: AsyncSession, notification_id: UUID) -> Notification | None:
        return await session.get(Notification, notification_id)

    @staticmethod
    async def list_for_user(
        session: AsyncSession,
        *,
        user_id: UUID,
        is_read: bool | None = None,
    ) -> list[Notification]:
        query = select(Notification).where(Notification.user_id == user_id)
        if is_read is not None:
            query = query.where(Notification.is_read == is_read)
        result = await session.execute(query.order_by(Notification.created_at.desc(), Notification.id.desc()))
        return list(result.scalars().all())
