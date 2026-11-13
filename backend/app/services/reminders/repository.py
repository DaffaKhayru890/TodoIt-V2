from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.reminders.models import Reminder


class ReminderRepository:
    @staticmethod
    async def get_by_id_for_update(session: AsyncSession, reminder_id: UUID) -> Reminder | None:
        result = await session.execute(
            select(Reminder).where(Reminder.id == reminder_id).with_for_update()
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def list_for_todo_and_user(
        session: AsyncSession,
        *,
        todo_id: UUID,
        user_id: UUID,
    ) -> list[Reminder]:
        result = await session.execute(
            select(Reminder)
            .where(Reminder.todo_id == todo_id, Reminder.user_id == user_id)
            .order_by(Reminder.remind_at.asc(), Reminder.id.asc())
        )
        return list(result.scalars().all())

    @staticmethod
    async def find_pending_automatic(
        session: AsyncSession,
        *,
        todo_id: UUID,
        user_id: UUID,
    ) -> Reminder | None:
        result = await session.execute(
            select(Reminder)
            .where(
                Reminder.todo_id == todo_id,
                Reminder.user_id == user_id,
                Reminder.source == "automatic",
                Reminder.status == "pending",
            )
            .with_for_update()
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def find_pending_manual_at(
        session: AsyncSession,
        *,
        todo_id: UUID,
        user_id: UUID,
        remind_at: datetime,
        exclude_id: UUID | None = None,
    ) -> Reminder | None:
        query = select(Reminder).where(
            Reminder.todo_id == todo_id,
            Reminder.user_id == user_id,
            Reminder.source == "manual",
            Reminder.status == "pending",
            Reminder.remind_at == remind_at,
        )
        if exclude_id is not None:
            query = query.where(Reminder.id != exclude_id)
        result = await session.execute(query)
        return result.scalar_one_or_none()

    @staticmethod
    async def list_due_for_update(
        session: AsyncSession,
        *,
        now: datetime,
        limit: int,
    ) -> list[Reminder]:
        result = await session.execute(
            select(Reminder)
            .where(Reminder.status == "pending", Reminder.remind_at <= now)
            .order_by(Reminder.remind_at.asc(), Reminder.id.asc())
            .limit(limit)
            .with_for_update(skip_locked=True)
        )
        return list(result.scalars().all())

    @staticmethod
    async def cancel_pending(
        session: AsyncSession,
        *,
        todo_id: UUID,
        user_id: UUID | None = None,
        source: str | None = None,
        now: datetime,
    ) -> int:
        query = (
            update(Reminder)
            .where(Reminder.todo_id == todo_id, Reminder.status == "pending")
            .values(status="cancelled", updated_at=now, processed_at=None)
        )
        if user_id is not None:
            query = query.where(Reminder.user_id == user_id)
        if source is not None:
            query = query.where(Reminder.source == source)
        result = await session.execute(query)
        return int(result.rowcount or 0)
