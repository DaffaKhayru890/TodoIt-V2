from __future__ import annotations

import pytest
from sqlalchemy import select

from app.common.cursor import encode_cursor
from app.core.config import settings
from app.core.exceptions import InvalidNotificationCursorError
from app.services.notifications.models import Notification
from app.services.notifications.service import NotificationService
from tests.factories import (
    add_member,
    create_notification,
    create_reminder,
    create_todo,
    create_user,
    create_workspace,
)


async def _notification_count(db_session) -> int:
    result = await db_session.execute(select(Notification))
    return len(list(result.scalars().all()))


async def test_manual_reminder_creates_todo_reminder_notification(
    db_session,
    clock,
) -> None:
    owner = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    todo = await create_todo(db_session, workspace=workspace, creator=owner, title="Ship it")
    reminder = await create_reminder(db_session, todo=todo, user=owner, source="manual")
    await db_session.commit()

    result = await NotificationService.create_notification_for_reminder(
        db_session,
        reminder,
        clock=clock,
    )

    assert result.created is True
    assert result.notification is not None
    assert result.notification.type == "todo_reminder"
    assert result.notification.title == "Todo Reminder"
    assert result.notification.message == "Reminder: Ship it"
    assert result.notification.is_read is False
    assert result.notification.read_at is None
    assert result.notification.user_id == owner.id
    assert reminder.status == "processed"
    assert reminder.processed_at == clock()


async def test_automatic_reminder_creates_due_date_notification(
    db_session,
    clock,
) -> None:
    owner = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    todo = await create_todo(db_session, workspace=workspace, creator=owner, title="Ship it")
    reminder = await create_reminder(db_session, todo=todo, user=owner, source="automatic")
    await db_session.commit()

    result = await NotificationService.create_notification_for_reminder(
        db_session,
        reminder,
        clock=clock,
    )

    assert result.notification is not None
    assert result.notification.type == "due_date_reminder"
    assert result.notification.title == "Upcoming Todo Due Date"
    assert "Ship it" in result.notification.message


async def test_recipient_comes_from_reminder_user(
    db_session,
    clock,
) -> None:
    owner = await create_user(db_session)
    member = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    await add_member(db_session, workspace=workspace, user=member)
    todo = await create_todo(db_session, workspace=workspace, creator=owner)
    reminder = await create_reminder(db_session, todo=todo, user=member, source="manual")
    await db_session.commit()

    result = await NotificationService.create_notification_for_reminder(
        db_session,
        reminder,
        clock=clock,
    )

    assert result.notification is not None
    assert result.notification.user_id == member.id


async def test_cancelled_reminder_does_not_create_notification(
    db_session,
    clock,
) -> None:
    owner = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    todo = await create_todo(db_session, workspace=workspace, creator=owner)
    reminder = await create_reminder(
        db_session,
        todo=todo,
        user=owner,
        status="cancelled",
    )
    await db_session.commit()

    result = await NotificationService.create_notification_for_reminder(
        db_session,
        reminder,
        clock=clock,
    )

    assert result.created is False
    assert result.notification is None
    assert await _notification_count(db_session) == 0


async def test_completed_todo_cancels_reminder_without_notification(
    db_session,
    clock,
) -> None:
    owner = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    todo = await create_todo(
        db_session,
        workspace=workspace,
        creator=owner,
        status="completed",
    )
    reminder = await create_reminder(db_session, todo=todo, user=owner)
    await db_session.commit()

    result = await NotificationService.create_notification_for_reminder(
        db_session,
        reminder,
        clock=clock,
    )

    assert result.cancelled is True
    assert reminder.status == "cancelled"
    assert await _notification_count(db_session) == 0


async def test_inactive_user_cancels_reminder_without_notification(
    db_session,
    clock,
) -> None:
    owner = await create_user(db_session, is_active=False)
    workspace = await create_workspace(db_session, owner=owner)
    todo = await create_todo(db_session, workspace=workspace, creator=owner)
    reminder = await create_reminder(db_session, todo=todo, user=owner)
    await db_session.commit()

    result = await NotificationService.create_notification_for_reminder(
        db_session,
        reminder,
        clock=clock,
    )

    assert result.cancelled is True
    assert reminder.status == "cancelled"
    assert await _notification_count(db_session) == 0


async def test_removed_member_cancels_reminder_without_notification(
    db_session,
    clock,
) -> None:
    owner = await create_user(db_session)
    member = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    todo = await create_todo(db_session, workspace=workspace, creator=owner)
    reminder = await create_reminder(db_session, todo=todo, user=member)
    await db_session.commit()

    result = await NotificationService.create_notification_for_reminder(
        db_session,
        reminder,
        clock=clock,
    )

    assert result.cancelled is True
    assert reminder.status == "cancelled"
    assert await _notification_count(db_session) == 0


async def test_archived_workspace_cancels_reminder_without_notification(
    db_session,
    clock,
) -> None:
    owner = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner, is_archived=True)
    todo = await create_todo(db_session, workspace=workspace, creator=owner)
    reminder = await create_reminder(db_session, todo=todo, user=owner)
    await db_session.commit()

    result = await NotificationService.create_notification_for_reminder(
        db_session,
        reminder,
        clock=clock,
    )

    assert result.cancelled is True
    assert reminder.status == "cancelled"
    assert await _notification_count(db_session) == 0


async def test_processing_same_reminder_twice_is_idempotent(
    db_session,
    clock,
) -> None:
    owner = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    todo = await create_todo(db_session, workspace=workspace, creator=owner)
    reminder = await create_reminder(db_session, todo=todo, user=owner)
    await db_session.commit()

    first = await NotificationService.create_notification_for_reminder(
        db_session,
        reminder,
        clock=clock,
    )
    await db_session.commit()
    second = await NotificationService.create_notification_for_reminder(
        db_session,
        reminder,
        clock=clock,
    )

    assert first.created is True
    assert second.created is False
    assert second.notification is not None
    assert second.notification.id == first.notification.id
    assert await _notification_count(db_session) == 1
    assert reminder.status == "processed"


async def test_existing_notification_is_reconciled_to_processed(
    db_session,
    clock,
) -> None:
    owner = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    todo = await create_todo(db_session, workspace=workspace, creator=owner)
    reminder = await create_reminder(db_session, todo=todo, user=owner)
    existing = await create_notification(
        db_session,
        user=owner,
        todo=todo,
        reminder=reminder,
    )
    await db_session.commit()

    result = await NotificationService.create_notification_for_reminder(
        db_session,
        reminder,
        clock=clock,
    )

    assert result.created is False
    assert result.notification is not None
    assert result.notification.id == existing.id
    assert reminder.status == "processed"
    assert await _notification_count(db_session) == 1


async def test_processed_reminder_without_notification_returns_nothing(
    db_session,
    clock,
) -> None:
    owner = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    todo = await create_todo(db_session, workspace=workspace, creator=owner)
    reminder = await create_reminder(
        db_session,
        todo=todo,
        user=owner,
        status="processed",
    )
    await db_session.commit()

    result = await NotificationService.create_notification_for_reminder(
        db_session,
        reminder,
        clock=clock,
    )

    assert result.created is False
    assert result.notification is None
    assert await _notification_count(db_session) == 0


async def test_cursor_with_malformed_payload_is_rejected(db_session) -> None:
    owner = await create_user(db_session)
    await db_session.commit()
    filter_hash = NotificationService._filter_hash(user_id=owner.id, is_read=None)
    cursor = encode_cursor(
        {
            "version": 1,
            "id": str(owner.id),
            "user_id": str(owner.id),
            "filter_hash": filter_hash,
        },
        secret=settings.pagination_cursor_secret.get_secret_value(),
    )

    with pytest.raises(InvalidNotificationCursorError):
        await NotificationService.list_notifications(
            db_session,
            user_id=owner.id,
            cursor=cursor,
        )
