from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.notifications.models import Notification


class NotificationRepository:
    @staticmethod
    async def get_for_user(
        session: AsyncSession,
        *,
        notification_id: UUID,
        user_id: UUID,
    ) -> Notification | None:
        result = await session.execute(
            select(Notification).where(
                Notification.id == notification_id,
                Notification.user_id == user_id,
            )
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def get_by_reminder_id(
        session: AsyncSession,
        reminder_id: UUID,
    ) -> Notification | None:
        result = await session.execute(
            select(Notification).where(Notification.reminder_id == reminder_id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def list_page(
        session: AsyncSession,
        *,
        user_id: UUID,
        is_read: bool | None,
        limit: int,
        cursor_created_at: datetime | None = None,
        cursor_id: UUID | None = None,
    ) -> list[Notification]:
        query = select(Notification).where(Notification.user_id == user_id)
        if is_read is not None:
            query = query.where(Notification.is_read.is_(is_read))
        if cursor_created_at is not None and cursor_id is not None:
            query = query.where(
                (Notification.created_at < cursor_created_at)
                | ((Notification.created_at == cursor_created_at) & (Notification.id < cursor_id))
            )
        query = query.order_by(Notification.created_at.desc(), Notification.id.desc())
        result = await session.execute(query.limit(limit + 1))
        return list(result.scalars().all())

    @staticmethod
    async def mark_all_read(
        session: AsyncSession,
        *,
        user_id: UUID,
        read_at: datetime,
    ) -> int:
        result = await session.execute(
            update(Notification)
            .where(Notification.user_id == user_id, Notification.is_read.is_(False))
            .values(is_read=True, read_at=read_at)
            .execution_options(synchronize_session=False)
        )
        return int(result.rowcount or 0)
