from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.reminders.models import Reminder


class ReminderRepository:
    @staticmethod
    async def get_by_id(session: AsyncSession, reminder_id: UUID) -> Reminder | None:
        return await session.get(Reminder, reminder_id)

    @staticmethod
    async def list_for_todo(session: AsyncSession, *, todo_id: UUID, user_id: UUID) -> list[Reminder]:
        result = await session.execute(
            select(Reminder).where(Reminder.todo_id == todo_id, Reminder.user_id == user_id)
        )
        return list(result.scalars().all())
