from __future__ import annotations

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import Clock, utc_now
from app.services.notifications.models import Notification
from app.services.notifications.service import NotificationService


class NotificationController:
    """Thin adapter between HTTP routes and notification business rules."""

    @staticmethod
    async def list_notifications(
        session: AsyncSession,
        *,
        user_id: UUID,
        is_read: bool | None = None,
        limit: int = 20,
        cursor: str | None = None,
    ) -> tuple[list[Notification], str | None, bool]:
        return await NotificationService.list_notifications(
            session,
            user_id=user_id,
            is_read=is_read,
            limit=limit,
            cursor=cursor,
        )

    @staticmethod
    async def get_notification(
        session: AsyncSession,
        *,
        notification_id: UUID,
        user_id: UUID,
    ) -> Notification:
        return await NotificationService.get_notification(
            session,
            notification_id=notification_id,
            user_id=user_id,
        )

    @staticmethod
    async def mark_read(
        session: AsyncSession,
        *,
        notification_id: UUID,
        user_id: UUID,
        clock: Clock = utc_now,
    ) -> Notification:
        return await NotificationService.mark_notification_read(
            session,
            notification_id=notification_id,
            user_id=user_id,
            clock=clock,
        )

    @staticmethod
    async def mark_all_read(
        session: AsyncSession,
        *,
        user_id: UUID,
        clock: Clock = utc_now,
    ) -> int:
        return await NotificationService.mark_all_notifications_read(
            session,
            user_id=user_id,
            clock=clock,
        )
