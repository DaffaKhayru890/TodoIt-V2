from __future__ import annotations

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.notifications.service import NotificationService


class NotificationController:
    @staticmethod
    async def list_notifications(
        session: AsyncSession,
        *,
        user_id: UUID,
        is_read: bool | None = None,
        limit: int = 20,
        cursor: str | None = None,
    ):
        return await NotificationService.list_notifications(
            session,
            user_id=user_id,
            is_read=is_read,
            limit=limit,
            cursor=cursor,
        )

    @staticmethod
    async def get_notification(session: AsyncSession, *, notification_id: UUID, user_id: UUID):
        return await NotificationService.get_notification(session, notification_id=notification_id, user_id=user_id)

    @staticmethod
    async def mark_read(session: AsyncSession, *, notification_id: UUID, user_id: UUID):
        return await NotificationService.mark_notification_read(
            session,
            notification_id=notification_id,
            user_id=user_id,
        )

    @staticmethod
    async def mark_all_read(session: AsyncSession, *, user_id: UUID):
        return await NotificationService.mark_all_notifications_read(session, user_id=user_id)
