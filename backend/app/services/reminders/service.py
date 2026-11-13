from __future__ import annotations

from datetime import datetime, timedelta
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import Clock, ensure_utc, utc_now
from app.core.config import settings
from app.core.exceptions import (
    ReminderAlreadyCancelledError,
    ReminderAlreadyProcessedError,
    ReminderDuplicateError,
    ReminderInvalidStateError,
    ReminderInvalidTimeError,
    ReminderNotFoundError,
    ReminderPermissionDeniedError,
    ReminderTodoNotFoundError,
    ReminderUserNotMemberError,
)
from app.services.reminders.models import Reminder
from app.services.reminders.repository import ReminderRepository
from app.services.todos.models import Todo
from app.services.workspaces.service import WorkspaceService


class ReminderService:
    """Business rules for personal reminders.

    All mutating methods own their transaction boundary. Automatic reminder
    synchronisation methods only flush so the caller (``TodoService``) can
    commit the Todo change and reminder change atomically.
    """

    @staticmethod
    async def _get_accessible_todo(
        session: AsyncSession,
        *,
        todo_id: UUID,
        user_id: UUID,
    ) -> Todo:
        todo = await session.get(Todo, todo_id)
        if todo is None:
            raise ReminderTodoNotFoundError()
        try:
            await WorkspaceService.require_access(session, todo.workspace_id, user_id)
        except HTTPException as exc:
            if exc.status_code == 403:
                raise ReminderUserNotMemberError() from exc
            raise ReminderTodoNotFoundError() from exc
        return todo

    @staticmethod
    def _normalise_remind_at(remind_at: datetime, clock: Clock) -> datetime:
        try:
            remind_at_utc = ensure_utc(remind_at)
        except ValueError as exc:
            raise ReminderInvalidTimeError(
                "Reminder time must include timezone information"
            ) from exc
        if remind_at_utc <= clock():
            raise ReminderInvalidTimeError("Reminder time must be in the future")
        return remind_at_utc

    @staticmethod
    async def create_manual_reminder(
        session: AsyncSession,
        *,
        todo_id: UUID,
        user_id: UUID,
        remind_at: datetime,
        clock: Clock = utc_now,
    ) -> Reminder:
        await ReminderService._get_accessible_todo(session, todo_id=todo_id, user_id=user_id)
        remind_at_utc = ReminderService._normalise_remind_at(remind_at, clock)

        duplicate = await ReminderRepository.find_pending_manual_at(
            session,
            todo_id=todo_id,
            user_id=user_id,
            remind_at=remind_at_utc,
        )
        if duplicate is not None:
            raise ReminderDuplicateError()

        reminder = Reminder(
            todo_id=todo_id,
            user_id=user_id,
            source="manual",
            status="pending",
            remind_at=remind_at_utc,
        )
        session.add(reminder)
        try:
            await session.flush()
        except IntegrityError as exc:
            await session.rollback()
            raise ReminderDuplicateError() from exc
        await session.commit()
        return reminder

    @staticmethod
    async def list_for_todo(
        session: AsyncSession,
        *,
        todo_id: UUID,
        user_id: UUID,
    ) -> list[Reminder]:
        await ReminderService._get_accessible_todo(session, todo_id=todo_id, user_id=user_id)
        return await ReminderRepository.list_for_todo_and_user(
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
        reminder = await ReminderRepository.get_by_id_for_update(session, reminder_id)
        if reminder is None:
            raise ReminderNotFoundError()
        if reminder.user_id != user_id:
            raise ReminderPermissionDeniedError()
        if reminder.status == "processed":
            raise ReminderAlreadyProcessedError()
        if reminder.status == "cancelled":
            raise ReminderAlreadyCancelledError()
        if reminder.source != "manual":
            raise ReminderInvalidStateError("Automatic reminders are managed by the Todo due date")

        remind_at_utc = ReminderService._normalise_remind_at(remind_at, clock)
        duplicate = await ReminderRepository.find_pending_manual_at(
            session,
            todo_id=reminder.todo_id,
            user_id=user_id,
            remind_at=remind_at_utc,
            exclude_id=reminder.id,
        )
        if duplicate is not None:
            raise ReminderDuplicateError()

        reminder.remind_at = remind_at_utc
        reminder.updated_at = clock()
        try:
            await session.flush()
        except IntegrityError as exc:
            await session.rollback()
            raise ReminderDuplicateError() from exc
        await session.commit()
        return reminder

    @staticmethod
    async def cancel_reminder(
        session: AsyncSession,
        *,
        reminder_id: UUID,
        user_id: UUID,
        clock: Clock = utc_now,
    ) -> None:
        reminder = await ReminderRepository.get_by_id_for_update(session, reminder_id)
        if reminder is None:
            raise ReminderNotFoundError()
        if reminder.user_id != user_id:
            raise ReminderPermissionDeniedError()
        if reminder.status == "cancelled":
            # Cancellation is idempotent: the resource is already in the
            # desired terminal state.
            return
        if reminder.status == "processed":
            raise ReminderAlreadyProcessedError()

        reminder.status = "cancelled"
        reminder.processed_at = None
        reminder.updated_at = clock()
        await session.commit()

    @staticmethod
    async def sync_automatic_reminder_for_todo(
        session: AsyncSession,
        todo: Todo,
        recipient_id: UUID,
        *,
        clock: Clock = utc_now,
    ) -> Reminder | None:
        """Create, move, or cancel the pending automatic reminder for a Todo.

        This method only flushes. The Todo service commits the Todo update and
        the reminder change in one transaction.
        """

        if not settings.automatic_due_reminders_enabled:
            return None

        now = clock()

        if todo.status == "completed":
            await ReminderRepository.cancel_pending(
                session,
                todo_id=todo.id,
                now=now,
            )
            return None

        if todo.due_at is None:
            await ReminderRepository.cancel_pending(
                session,
                todo_id=todo.id,
                user_id=recipient_id,
                source="automatic",
                now=now,
            )
            return None

        due_at_utc = ensure_utc(todo.due_at)
        if due_at_utc <= now:
            await ReminderRepository.cancel_pending(
                session,
                todo_id=todo.id,
                user_id=recipient_id,
                source="automatic",
                now=now,
            )
            return None

        trigger_at = due_at_utc - timedelta(minutes=settings.default_due_reminder_minutes)
        if trigger_at <= now:
            # The due date is closer than the configured lead time. Deliver the
            # reminder on the next worker poll instead of scheduling it in the
            # past.
            trigger_at = now

        reminder = await ReminderRepository.find_pending_automatic(
            session,
            todo_id=todo.id,
            user_id=recipient_id,
        )
        if reminder is not None:
            reminder.remind_at = trigger_at
            reminder.updated_at = now
            await session.flush()
            return reminder

        reminder = Reminder(
            todo_id=todo.id,
            user_id=recipient_id,
            source="automatic",
            status="pending",
            remind_at=trigger_at,
        )
        session.add(reminder)
        await session.flush()
        return reminder

    @staticmethod
    async def cancel_pending_for_todo(
        session: AsyncSession,
        *,
        todo_id: UUID,
        clock: Clock = utc_now,
    ) -> int:
        """Cancel every pending reminder for a Todo (manual and automatic)."""

        return await ReminderRepository.cancel_pending(
            session,
            todo_id=todo_id,
            now=clock(),
        )
