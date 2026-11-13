from __future__ import annotations

import base64
import hashlib
import hmac
import json
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.services.notifications.models import Notification
from app.services.reminders.models import Reminder
from app.services.todos.models import Todo
from app.services.users.models import User
from app.services.workspaces.models import Workspace, WorkspaceMember


def _utc_now() -> datetime:
    return datetime.now(UTC)


class NotificationService:
    @staticmethod
    async def create_notification_for_reminder(
        session: AsyncSession,
        reminder: Reminder,
    ) -> Notification:
        existing = await session.execute(
            select(Notification).where(Notification.reminder_id == reminder.id)
        )
        notification = existing.scalar_one_or_none()
        if notification is not None:
            reminder.status = "processed"
            reminder.processed_at = _utc_now()
            reminder.updated_at = _utc_now()
            await session.flush()
            return notification

        todo = await session.get(Todo, reminder.todo_id)
        if todo is None:
            reminder.status = "cancelled"
            reminder.updated_at = _utc_now()
            await session.flush()
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="TODO_NOT_FOUND")

        user = await session.get(User, reminder.user_id)
        if user is None or not user.is_active:
            reminder.status = "cancelled"
            reminder.updated_at = _utc_now()
            await session.flush()
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="USER_INACTIVE")

        workspace = await session.get(Workspace, todo.workspace_id)
        if workspace is None or workspace.is_archived:
            reminder.status = "cancelled"
            reminder.updated_at = _utc_now()
            await session.flush()
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="WORKSPACE_ARCHIVED")

        membership = await session.execute(
            select(WorkspaceMember).where(
                WorkspaceMember.workspace_id == todo.workspace_id,
                WorkspaceMember.user_id == reminder.user_id,
            )
        )
        if membership.scalar_one_or_none() is None:
            reminder.status = "cancelled"
            reminder.updated_at = _utc_now()
            await session.flush()
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="WORKSPACE_ACCESS_DENIED",
            )

        title = "Todo Reminder" if reminder.source == "manual" else "Upcoming Todo Due Date"
        message = (
            f"Reminder: {todo.title}"
            if reminder.source == "manual"
            else f"Your Todo is approaching its due date: {todo.title}"
        )
        notification = Notification(
            user_id=reminder.user_id,
            todo_id=reminder.todo_id,
            reminder_id=reminder.id,
            title=title,
            message=message,
            type="todo_reminder" if reminder.source == "manual" else "due_date_reminder",
        )
        session.add(notification)
        await session.flush()
        reminder.status = "processed"
        reminder.processed_at = _utc_now()
        reminder.updated_at = _utc_now()
        return notification

    @staticmethod
    async def list_notifications(
        session: AsyncSession,
        *,
        user_id: UUID,
        is_read: bool | None = None,
        limit: int = 20,
        cursor: str | None = None,
    ) -> tuple[list[Notification], str | None, bool]:
        query = select(Notification).where(Notification.user_id == user_id)
        if is_read is not None:
            query = query.where(Notification.is_read == is_read)
        filter_hash = NotificationService._filter_hash(user_id=user_id, is_read=is_read)
        if cursor:
            payload = NotificationService._decode_cursor(cursor)
            if payload["filter_hash"] != filter_hash:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="CURSOR_FILTER_MISMATCH")
            query = query.where(
                (Notification.created_at < payload["created_at"])
                | (
                    (Notification.created_at == payload["created_at"])
                    & (Notification.id < payload["id"]) 
                )
            )

        query = query.order_by(Notification.created_at.desc(), Notification.id.desc())
        items = list((await session.execute(query.limit(limit + 1))).scalars().all())
        has_more = len(items) > limit
        if has_more:
            items = items[:limit]
            next_cursor = NotificationService._encode_cursor(
                items[-1].created_at,
                items[-1].id,
                filter_hash,
            )
        else:
            next_cursor = None
        return items, next_cursor, has_more

    @staticmethod
    async def get_notification(
        session: AsyncSession,
        *,
        notification_id: UUID,
        user_id: UUID,
    ) -> Notification:
        notification = await session.get(Notification, notification_id)
        if notification is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="NOTIFICATION_NOT_FOUND")
        if notification.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="NOTIFICATION_PERMISSION_DENIED",
            )
        return notification

    @staticmethod
    async def mark_notification_read(
        session: AsyncSession,
        *,
        notification_id: UUID,
        user_id: UUID,
    ) -> Notification:
        notification = await NotificationService.get_notification(
            session,
            notification_id=notification_id,
            user_id=user_id,
        )
        if notification.is_read:
            return notification
        notification.is_read = True
        notification.read_at = _utc_now()
        await session.commit()
        return notification

    @staticmethod
    async def mark_all_notifications_read(
        session: AsyncSession,
        *,
        user_id: UUID,
    ) -> int:
        now = _utc_now()
        result = await session.execute(
            select(Notification).where(Notification.user_id == user_id, Notification.is_read.is_(False))
        )
        notifications = list(result.scalars().all())
        for notification in notifications:
            notification.is_read = True
            notification.read_at = now
        if notifications:
            await session.commit()
        return len(notifications)

    @staticmethod
    def _filter_hash(*, user_id: UUID, is_read: bool | None) -> str:
        payload = {
            "user_id": str(user_id),
            "is_read": is_read,
        }
        raw = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    @staticmethod
    def _encode_cursor(created_at: datetime, notification_id: UUID, filter_hash: str) -> str:
        payload = {
            "version": 1,
            "created_at": created_at.astimezone(UTC).isoformat(),
            "id": str(notification_id),
            "filter_hash": filter_hash,
        }
        raw = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
        digest = hmac.new(
            settings.pagination_cursor_secret.get_secret_value().encode("utf-8"),
            raw,
            hashlib.sha256,
        ).digest()
        encoded = (
            base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")
            + "."
            + base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")
        )
        return encoded

    @staticmethod
    def _decode_cursor(cursor: str) -> dict[str, Any]:
        try:
            payload_b64, sig_b64 = cursor.split(".", 1)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="INVALID_CURSOR") from exc
        try:
            raw_payload = base64.urlsafe_b64decode(payload_b64 + "=" * (-len(payload_b64) % 4))
            expected_sig = base64.urlsafe_b64decode(sig_b64 + "=" * (-len(sig_b64) % 4))
        except Exception as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="INVALID_CURSOR") from exc
        digest = hmac.new(
            settings.pagination_cursor_secret.get_secret_value().encode("utf-8"),
            raw_payload,
            hashlib.sha256,
        ).digest()
        if not hmac.compare_digest(digest, expected_sig):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="CURSOR_SIGNATURE_INVALID")
        try:
            payload = json.loads(raw_payload.decode("utf-8"))
        except Exception as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="INVALID_CURSOR") from exc
        if payload.get("version") != 1:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="INVALID_CURSOR")
        if "created_at" not in payload or "id" not in payload or "filter_hash" not in payload:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="INVALID_CURSOR")
        try:
            created_at = datetime.fromisoformat(payload["created_at"]).astimezone(UTC)
            notification_id = UUID(payload["id"])
        except Exception as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="INVALID_CURSOR") from exc
        return {"created_at": created_at, "id": notification_id, "filter_hash": payload["filter_hash"]}
