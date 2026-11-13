from __future__ import annotations

import base64
import hashlib
import hmac
import json
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.services.reminders.models import Reminder
from app.services.todos.models import Todo
from app.services.users.models import User
from app.services.workspaces.models import WorkspaceMember
from app.services.workspaces.service import WorkspaceService


def _utc_now() -> datetime:
    return datetime.now(UTC)


def _coerce_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="INVALID_REMINDER_TIME",
        )
    return value.astimezone(UTC)


class ReminderService:
    @staticmethod
    async def get_by_id(session: AsyncSession, reminder_id: UUID) -> Reminder | None:
        return await session.get(Reminder, reminder_id)

    @staticmethod
    async def create_manual_reminder(
        session: AsyncSession,
        *,
        todo_id: UUID,
        user_id: UUID,
        remind_at: datetime,
    ) -> Reminder:
        todo = await session.get(Todo, todo_id)
        if todo is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="TODO_NOT_FOUND")
        await WorkspaceService.require_access(session, todo.workspace_id, user_id)

        remind_at_utc = _coerce_utc(remind_at)
        if remind_at_utc <= _utc_now():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="INVALID_REMINDER_TIME",
            )

        reminder = Reminder(
            todo_id=todo_id,
            user_id=user_id,
            source="manual",
            status="pending",
            remind_at=remind_at_utc,
        )
        session.add(reminder)
        await session.commit()
        return reminder

    @staticmethod
    async def list_for_todo(
        session: AsyncSession,
        *,
        todo_id: UUID,
        user_id: UUID,
    ) -> list[Reminder]:
        todo = await session.get(Todo, todo_id)
        if todo is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="TODO_NOT_FOUND")
        await WorkspaceService.require_access(session, todo.workspace_id, user_id)
        result = await session.execute(
            select(Reminder)
            .where(Reminder.todo_id == todo_id, Reminder.user_id == user_id)
            .order_by(Reminder.remind_at.asc(), Reminder.id.asc())
        )
        return list(result.scalars().all())

    @staticmethod
    async def update_reminder(
        session: AsyncSession,
        *,
        reminder_id: UUID,
        user_id: UUID,
        remind_at: datetime,
    ) -> Reminder:
        reminder = await ReminderService.get_by_id(session, reminder_id)
        if reminder is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="REMINDER_NOT_FOUND")
        if reminder.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="REMINDER_PERMISSION_DENIED",
            )
        if reminder.source != "manual" or reminder.status != "pending":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="REMINDER_INVALID_STATE",
            )

        remind_at_utc = _coerce_utc(remind_at)
        if remind_at_utc <= _utc_now():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="INVALID_REMINDER_TIME",
            )

        reminder.remind_at = remind_at_utc
        reminder.updated_at = _utc_now()
        await session.commit()
        return reminder

    @staticmethod
    async def cancel_reminder(
        session: AsyncSession,
        *,
        reminder_id: UUID,
        user_id: UUID,
    ) -> None:
        reminder = await ReminderService.get_by_id(session, reminder_id)
        if reminder is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="REMINDER_NOT_FOUND")
        if reminder.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="REMINDER_PERMISSION_DENIED",
            )
        if reminder.status == "cancelled":
            return
        if reminder.status == "processed":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="REMINDER_ALREADY_PROCESSED",
            )
        reminder.status = "cancelled"
        reminder.updated_at = _utc_now()
        await session.commit()

    @staticmethod
    async def cancel_pending_for_todo(session: AsyncSession, *, todo_id: UUID) -> None:
        result = await session.execute(
            select(Reminder).where(
                Reminder.todo_id == todo_id,
                Reminder.status == "pending",
            )
        )
        reminders = list(result.scalars().all())
        for reminder in reminders:
            reminder.status = "cancelled"
            reminder.updated_at = _utc_now()
        if reminders:
            await session.commit()

    @staticmethod
    async def sync_automatic_reminder_for_todo(
        session: AsyncSession,
        todo: Todo,
        user_id: UUID,
    ) -> Reminder | None:
        if not settings.automatic_due_reminders_enabled:
            return None
        if todo.status == "completed":
            await ReminderService.cancel_pending_for_todo(session, todo_id=todo.id)
            return None
        if todo.due_at is None:
            await ReminderService.cancel_pending_for_todo(session, todo_id=todo.id)
            return None

        due_at_utc = _coerce_utc(todo.due_at)
        if due_at_utc <= _utc_now():
            await ReminderService.cancel_pending_for_todo(session, todo_id=todo.id)
            return None

        trigger_at = due_at_utc - timedelta(minutes=settings.default_due_reminder_minutes)
        if trigger_at <= _utc_now():
            trigger_at = _utc_now()

        existing = await session.execute(
            select(Reminder).where(
                Reminder.todo_id == todo.id,
                Reminder.user_id == user_id,
                Reminder.source == "automatic",
                Reminder.status == "pending",
            )
        )
        reminder = existing.scalar_one_or_none()
        if reminder is not None:
            reminder.remind_at = trigger_at
            reminder.updated_at = _utc_now()
            return reminder

        reminder = Reminder(
            todo_id=todo.id,
            user_id=user_id,
            source="automatic",
            status="pending",
            remind_at=trigger_at,
        )
        session.add(reminder)
        await session.flush()
        return reminder

    @staticmethod
    async def list_due_reminders(session: AsyncSession, limit: int) -> list[Reminder]:
        result = await session.execute(
            select(Reminder)
            .where(Reminder.status == "pending", Reminder.remind_at <= _utc_now())
            .order_by(Reminder.remind_at.asc(), Reminder.id.asc())
            .limit(limit)
            .with_for_update(skip_locked=True)
        )
        return list(result.scalars().all())

    @staticmethod
    async def mark_processed(session: AsyncSession, reminder: Reminder) -> None:
        reminder.status = "processed"
        reminder.processed_at = _utc_now()
        reminder.updated_at = _utc_now()
        await session.flush()

    @staticmethod
    async def cancel_if_unusable(session: AsyncSession, reminder: Reminder) -> None:
        reminder.status = "cancelled"
        reminder.updated_at = _utc_now()
        await session.flush()
