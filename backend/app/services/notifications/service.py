from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.cursor import (
    CURSOR_SIGNATURE_INVALID,
    CURSOR_VERSION,
    CURSOR_VERSION_INVALID,
    CursorError,
    decode_cursor,
    encode_cursor,
)
from app.core.clock import Clock, ensure_utc, utc_now
from app.core.config import settings
from app.core.exceptions import (
    ApiError,
    InvalidNotificationCursorError,
    NotificationCursorSignatureInvalidError,
    NotificationCursorUserMismatchError,
    NotificationNotFoundError,
)
from app.services.notifications.models import Notification
from app.services.notifications.repository import NotificationRepository
from app.services.reminders.models import Reminder
from app.services.todos.models import Todo
from app.services.users.models import User
from app.services.workspaces.models import Workspace, WorkspaceMember

DEFAULT_NOTIFICATION_LIMIT = 20
MAX_NOTIFICATION_LIMIT = 100


@dataclass(slots=True)
class NotificationDeliveryResult:
    notification: Notification | None
    created: bool
    cancelled: bool = False


class NotificationService:
    @staticmethod
    async def create_notification_for_reminder(
        session: AsyncSession,
        reminder: Reminder,
        *,
        clock: Clock = utc_now,
    ) -> NotificationDeliveryResult:
        """Create one notification for a due reminder.

        The method is idempotent: an existing notification for the reminder is
        returned and the reminder is reconciled to ``processed``. Reminders that
        are no longer deliverable are cancelled instead of producing a
        notification.
        """

        existing = await NotificationRepository.get_by_reminder_id(session, reminder.id)
        if existing is not None:
            if reminder.status == "pending":
                await NotificationService._mark_processed(session, reminder, clock)
            return NotificationDeliveryResult(existing, created=False)

        if reminder.status == "cancelled":
            return NotificationDeliveryResult(None, created=False, cancelled=True)
        if reminder.status != "pending":
            return NotificationDeliveryResult(None, created=False)

        todo = await session.get(Todo, reminder.todo_id)
        if todo is None:
            await NotificationService._cancel_reminder(session, reminder, clock)
            return NotificationDeliveryResult(None, created=False, cancelled=True)

        if todo.status == "completed":
            await NotificationService._cancel_reminder(session, reminder, clock)
            return NotificationDeliveryResult(None, created=False, cancelled=True)

        user = await session.get(User, reminder.user_id)
        if user is None or not user.is_active:
            await NotificationService._cancel_reminder(session, reminder, clock)
            return NotificationDeliveryResult(None, created=False, cancelled=True)

        workspace = await session.get(Workspace, todo.workspace_id)
        if workspace is None or workspace.is_archived:
            await NotificationService._cancel_reminder(session, reminder, clock)
            return NotificationDeliveryResult(None, created=False, cancelled=True)

        membership = await session.execute(
            select(WorkspaceMember.id).where(
                WorkspaceMember.workspace_id == todo.workspace_id,
                WorkspaceMember.user_id == reminder.user_id,
            )
        )
        if membership.scalar_one_or_none() is None:
            await NotificationService._cancel_reminder(session, reminder, clock)
            return NotificationDeliveryResult(None, created=False, cancelled=True)

        is_manual = reminder.source == "manual"
        notification = Notification(
            user_id=reminder.user_id,
            todo_id=reminder.todo_id,
            reminder_id=reminder.id,
            title="Todo Reminder" if is_manual else "Upcoming Todo Due Date",
            message=(
                f"Reminder: {todo.title}"
                if is_manual
                else f"Your Todo is approaching its due date: {todo.title}"
            ),
            type="todo_reminder" if is_manual else "due_date_reminder",
            is_read=False,
            read_at=None,
        )
        session.add(notification)
        await NotificationService._mark_processed(session, reminder, clock)
        await session.flush()
        return NotificationDeliveryResult(notification, created=True)

    @staticmethod
    async def _mark_processed(
        session: AsyncSession,
        reminder: Reminder,
        clock: Clock,
    ) -> None:
        now = clock()
        reminder.status = "processed"
        reminder.processed_at = now
        reminder.updated_at = now
        await session.flush()

    @staticmethod
    async def _cancel_reminder(
        session: AsyncSession,
        reminder: Reminder,
        clock: Clock,
    ) -> None:
        reminder.status = "cancelled"
        reminder.processed_at = None
        reminder.updated_at = clock()
        await session.flush()

    @staticmethod
    def _filter_hash(*, user_id: UUID, is_read: bool | None) -> str:
        payload = {"user_id": str(user_id), "is_read": is_read}
        raw = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    @staticmethod
    def _cursor_secret() -> str:
        return settings.pagination_cursor_secret.get_secret_value()

    @staticmethod
    async def list_notifications(
        session: AsyncSession,
        *,
        user_id: UUID,
        is_read: bool | None = None,
        limit: int = DEFAULT_NOTIFICATION_LIMIT,
        cursor: str | None = None,
    ) -> tuple[list[Notification], str | None, bool]:
        if limit < 1 or limit > MAX_NOTIFICATION_LIMIT:
            raise ApiError(
                "INVALID_NOTIFICATION_FILTER",
                f"limit must be between 1 and {MAX_NOTIFICATION_LIMIT}",
                status_code=422,
            )

        filter_hash = NotificationService._filter_hash(user_id=user_id, is_read=is_read)
        cursor_created_at: datetime | None = None
        cursor_id: UUID | None = None

        if cursor:
            payload = NotificationService._decode_cursor(cursor)
            cursor_user_id = payload.get("user_id")
            if cursor_user_id != str(user_id):
                raise NotificationCursorUserMismatchError()
            if payload.get("filter_hash") != filter_hash:
                raise InvalidNotificationCursorError(
                    "Notification cursor does not match the current filter"
                )
            try:
                cursor_created_at = ensure_utc(datetime.fromisoformat(payload["created_at"]))
                cursor_id = UUID(payload["id"])
            except (KeyError, TypeError, ValueError) as exc:
                raise InvalidNotificationCursorError() from exc

        items = await NotificationRepository.list_page(
            session,
            user_id=user_id,
            is_read=is_read,
            limit=limit,
            cursor_created_at=cursor_created_at,
            cursor_id=cursor_id,
        )
        has_more = len(items) > limit
        if has_more:
            items = items[:limit]
            next_cursor = NotificationService._encode_cursor(
                created_at=items[-1].created_at,
                notification_id=items[-1].id,
                user_id=user_id,
                filter_hash=filter_hash,
            )
        else:
            next_cursor = None
        return items, next_cursor, has_more

    @staticmethod
    def _encode_cursor(
        *,
        created_at: datetime,
        notification_id: UUID,
        user_id: UUID,
        filter_hash: str,
    ) -> str:
        payload = {
            "version": CURSOR_VERSION,
            "created_at": ensure_utc(created_at).isoformat(),
            "id": str(notification_id),
            "user_id": str(user_id),
            "filter_hash": filter_hash,
        }
        return encode_cursor(payload, secret=NotificationService._cursor_secret())

    @staticmethod
    def _decode_cursor(cursor: str) -> dict:
        try:
            return decode_cursor(cursor, secret=NotificationService._cursor_secret())
        except CursorError as exc:
            if exc.code == CURSOR_SIGNATURE_INVALID:
                raise NotificationCursorSignatureInvalidError() from exc
            if exc.code == CURSOR_VERSION_INVALID:
                raise InvalidNotificationCursorError("Unsupported cursor version") from exc
            raise InvalidNotificationCursorError() from exc

    @staticmethod
    async def get_notification(
        session: AsyncSession,
        *,
        notification_id: UUID,
        user_id: UUID,
    ) -> Notification:
        notification = await NotificationRepository.get_for_user(
            session,
            notification_id=notification_id,
            user_id=user_id,
        )
        if notification is None:
            # Returning 404 avoids leaking whether another user's notification
            # exists.
            raise NotificationNotFoundError()
        return notification

    @staticmethod
    async def mark_notification_read(
        session: AsyncSession,
        *,
        notification_id: UUID,
        user_id: UUID,
        clock: Clock = utc_now,
    ) -> Notification:
        notification = await NotificationService.get_notification(
            session,
            notification_id=notification_id,
            user_id=user_id,
        )
        if notification.is_read:
            return notification
        notification.is_read = True
        notification.read_at = clock()
        await session.commit()
        return notification

    @staticmethod
    async def mark_all_notifications_read(
        session: AsyncSession,
        *,
        user_id: UUID,
        clock: Clock = utc_now,
    ) -> int:
        updated = await NotificationRepository.mark_all_read(
            session,
            user_id=user_id,
            read_at=clock(),
        )
        await session.commit()
        return updated
