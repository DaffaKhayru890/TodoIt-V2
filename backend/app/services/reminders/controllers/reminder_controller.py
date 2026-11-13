from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import Clock, utc_now
from app.services.reminders.models import Reminder
from app.services.reminders.service import ReminderService


class ReminderController:
    """Thin adapter between HTTP routes and reminder business rules."""

    @staticmethod
    async def create_manual_reminder(
        session: AsyncSession,
        *,
        todo_id: UUID,
        user_id: UUID,
        remind_at: datetime,
        clock: Clock = utc_now,
    ) -> Reminder:
        return await ReminderService.create_manual_reminder(
            session,
            todo_id=todo_id,
            user_id=user_id,
            remind_at=remind_at,
            clock=clock,
        )

    @staticmethod
    async def list_todo_reminders(
        session: AsyncSession,
        *,
        todo_id: UUID,
        user_id: UUID,
    ) -> list[Reminder]:
        return await ReminderService.list_for_todo(
            session,
            todo_id=todo_id,
            user_id=user_id,
        )

    @staticmethod
    async def update_reminder(
        session: AsyncSession,
        *,
        reminder_id: UUID,
        user_id: UUID,
        remind_at: datetime,
        clock: Clock = utc_now,
    ) -> Reminder:
        return await ReminderService.update_reminder(
            session,
            reminder_id=reminder_id,
            user_id=user_id,
            remind_at=remind_at,
            clock=clock,
        )

    @staticmethod
    async def cancel_reminder(
        session: AsyncSession,
        *,
        reminder_id: UUID,
        user_id: UUID,
        clock: Clock = utc_now,
    ) -> None:
        await ReminderService.cancel_reminder(
            session,
            reminder_id=reminder_id,
            user_id=user_id,
            clock=clock,
        )
