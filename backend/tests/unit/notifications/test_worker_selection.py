from __future__ import annotations

from datetime import timedelta

import pytest
from sqlalchemy import select
from sqlalchemy.exc import OperationalError

from app.core.config import settings
from app.services.notifications import worker as worker_module
from app.services.notifications.models import Notification
from app.services.notifications.worker import process_due_reminders, run_worker
from app.services.reminders.repository import ReminderRepository
from tests.factories import (
    create_notification,
    create_reminder,
    create_todo,
    create_user,
    create_workspace,
)


async def _notification_count(db_session) -> int:
    result = await db_session.execute(select(Notification))
    return len(list(result.scalars().all()))


async def test_no_due_reminder(session_factory, db_session, clock) -> None:
    result = await process_due_reminders(session_factory=session_factory, clock=clock)

    assert result.selected == 0
    assert result.processed == 0


async def test_one_due_reminder_is_processed(
    session_factory,
    db_session,
    clock,
    fixed_now,
) -> None:
    owner = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    todo = await create_todo(db_session, workspace=workspace, creator=owner)
    reminder = await create_reminder(
        db_session,
        todo=todo,
        user=owner,
        remind_at=fixed_now - timedelta(minutes=1),
    )
    await db_session.commit()

    result = await process_due_reminders(session_factory=session_factory, clock=clock)

    assert result.selected == 1
    assert result.processed == 1
    await db_session.refresh(reminder)
    assert reminder.status == "processed"
    assert reminder.processed_at == fixed_now
    assert await _notification_count(db_session) == 1


async def test_multiple_due_reminders_are_processed(
    session_factory,
    db_session,
    clock,
    fixed_now,
) -> None:
    owner = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    for index in range(3):
        todo = await create_todo(
            db_session,
            workspace=workspace,
            creator=owner,
            title=f"Todo {index}",
        )
        await create_reminder(
            db_session,
            todo=todo,
            user=owner,
            remind_at=fixed_now - timedelta(minutes=index + 1),
        )
    await db_session.commit()

    result = await process_due_reminders(session_factory=session_factory, clock=clock)

    assert result.selected == 3
    assert result.processed == 3
    assert await _notification_count(db_session) == 3


async def test_future_reminder_is_not_processed(
    session_factory,
    db_session,
    clock,
    fixed_now,
) -> None:
    owner = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    todo = await create_todo(db_session, workspace=workspace, creator=owner)
    reminder = await create_reminder(
        db_session,
        todo=todo,
        user=owner,
        remind_at=fixed_now + timedelta(minutes=10),
    )
    await db_session.commit()

    result = await process_due_reminders(session_factory=session_factory, clock=clock)

    assert result.selected == 0
    await db_session.refresh(reminder)
    assert reminder.status == "pending"
    assert await _notification_count(db_session) == 0


async def test_cancelled_and_processed_reminders_are_skipped(
    session_factory,
    db_session,
    clock,
    fixed_now,
) -> None:
    owner = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    todo = await create_todo(db_session, workspace=workspace, creator=owner)
    await create_reminder(
        db_session,
        todo=todo,
        user=owner,
        status="cancelled",
        remind_at=fixed_now - timedelta(minutes=1),
    )
    await create_reminder(
        db_session,
        todo=todo,
        user=owner,
        status="processed",
        remind_at=fixed_now - timedelta(minutes=1),
    )
    await db_session.commit()

    result = await process_due_reminders(session_factory=session_factory, clock=clock)

    assert result.selected == 0
    assert await _notification_count(db_session) == 0


async def test_completed_todo_is_cancelled_without_notification(
    session_factory,
    db_session,
    clock,
    fixed_now,
) -> None:
    owner = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    todo = await create_todo(
        db_session,
        workspace=workspace,
        creator=owner,
        status="completed",
    )
    reminder = await create_reminder(
        db_session,
        todo=todo,
        user=owner,
        remind_at=fixed_now - timedelta(minutes=1),
    )
    await db_session.commit()

    result = await process_due_reminders(session_factory=session_factory, clock=clock)

    assert result.selected == 1
    assert result.cancelled == 1
    await db_session.refresh(reminder)
    assert reminder.status == "cancelled"
    assert await _notification_count(db_session) == 0


async def test_archived_workspace_is_cancelled_without_notification(
    session_factory,
    db_session,
    clock,
    fixed_now,
) -> None:
    owner = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner, is_archived=True)
    todo = await create_todo(db_session, workspace=workspace, creator=owner)
    reminder = await create_reminder(
        db_session,
        todo=todo,
        user=owner,
        remind_at=fixed_now - timedelta(minutes=1),
    )
    await db_session.commit()

    result = await process_due_reminders(session_factory=session_factory, clock=clock)

    assert result.cancelled == 1
    await db_session.refresh(reminder)
    assert reminder.status == "cancelled"
    assert await _notification_count(db_session) == 0


async def test_inactive_user_is_cancelled_without_notification(
    session_factory,
    db_session,
    clock,
    fixed_now,
) -> None:
    owner = await create_user(db_session, is_active=False)
    workspace = await create_workspace(db_session, owner=owner)
    todo = await create_todo(db_session, workspace=workspace, creator=owner)
    reminder = await create_reminder(
        db_session,
        todo=todo,
        user=owner,
        remind_at=fixed_now - timedelta(minutes=1),
    )
    await db_session.commit()

    result = await process_due_reminders(session_factory=session_factory, clock=clock)

    assert result.cancelled == 1
    await db_session.refresh(reminder)
    assert reminder.status == "cancelled"
    assert await _notification_count(db_session) == 0


async def test_removed_member_is_cancelled_without_notification(
    session_factory,
    db_session,
    clock,
    fixed_now,
) -> None:
    owner = await create_user(db_session)
    member = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    todo = await create_todo(db_session, workspace=workspace, creator=owner)
    reminder = await create_reminder(
        db_session,
        todo=todo,
        user=member,
        remind_at=fixed_now - timedelta(minutes=1),
    )
    await db_session.commit()

    result = await process_due_reminders(session_factory=session_factory, clock=clock)

    assert result.cancelled == 1
    await db_session.refresh(reminder)
    assert reminder.status == "cancelled"
    assert await _notification_count(db_session) == 0


async def test_worker_is_idempotent_across_iterations(
    session_factory,
    db_session,
    clock,
    fixed_now,
) -> None:
    owner = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    todo = await create_todo(db_session, workspace=workspace, creator=owner)
    await create_reminder(
        db_session,
        todo=todo,
        user=owner,
        remind_at=fixed_now - timedelta(minutes=1),
    )
    await db_session.commit()

    first = await process_due_reminders(session_factory=session_factory, clock=clock)
    second = await process_due_reminders(session_factory=session_factory, clock=clock)

    assert first.processed == 1
    assert second.selected == 0
    assert second.processed == 0
    assert await _notification_count(db_session) == 1


async def test_existing_notification_prevents_duplicate(
    session_factory,
    db_session,
    clock,
    fixed_now,
) -> None:
    owner = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    todo = await create_todo(db_session, workspace=workspace, creator=owner)
    reminder = await create_reminder(
        db_session,
        todo=todo,
        user=owner,
        remind_at=fixed_now - timedelta(minutes=1),
    )
    await create_notification(db_session, user=owner, todo=todo, reminder=reminder)
    await db_session.commit()

    result = await process_due_reminders(session_factory=session_factory, clock=clock)

    assert result.duplicates == 1
    await db_session.refresh(reminder)
    assert reminder.status == "processed"
    assert await _notification_count(db_session) == 1


async def test_disabled_worker_does_not_process_jobs(
    session_factory,
    db_session,
    clock,
    fixed_now,
    monkeypatch,
) -> None:
    owner = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    todo = await create_todo(db_session, workspace=workspace, creator=owner)
    reminder = await create_reminder(
        db_session,
        todo=todo,
        user=owner,
        remind_at=fixed_now - timedelta(minutes=1),
    )
    await db_session.commit()
    monkeypatch.setattr(settings, "notification_worker_enabled", False)

    result = await process_due_reminders(session_factory=session_factory, clock=clock)

    assert result.selected == 0
    await db_session.refresh(reminder)
    assert reminder.status == "pending"


async def test_worker_loop_stops_on_event(session_factory, clock) -> None:
    import asyncio

    stop_event = asyncio.Event()
    stop_event.set()

    await run_worker(
        stop_event,
        session_factory=session_factory,
        clock=clock,
        max_iterations=5,
    )


async def test_database_error_leaves_reminder_recoverable(
    session_factory,
    db_session,
    clock,
    fixed_now,
    monkeypatch,
) -> None:
    owner = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    todo = await create_todo(db_session, workspace=workspace, creator=owner)
    reminder = await create_reminder(
        db_session,
        todo=todo,
        user=owner,
        remind_at=fixed_now - timedelta(minutes=1),
    )
    await db_session.commit()

    async def fail_selection(*args, **kwargs):
        raise OperationalError("SELECT 1", {}, Exception("database unavailable"))

    monkeypatch.setattr(ReminderRepository, "list_due_for_update", staticmethod(fail_selection))

    with pytest.raises(OperationalError):
        await process_due_reminders(session_factory=session_factory, clock=clock)

    await db_session.refresh(reminder)
    assert reminder.status == "pending"
    assert await _notification_count(db_session) == 0


async def test_one_bad_record_does_not_stop_batch(
    session_factory,
    db_session,
    clock,
    fixed_now,
    monkeypatch,
) -> None:
    owner = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    todo = await create_todo(db_session, workspace=workspace, creator=owner)
    reminder = await create_reminder(
        db_session,
        todo=todo,
        user=owner,
        remind_at=fixed_now - timedelta(minutes=1),
    )
    await db_session.commit()

    original = worker_module.NotificationService.create_notification_for_reminder
    calls = {"count": 0}

    async def flaky(*args, **kwargs):
        calls["count"] += 1
        if calls["count"] == 1:
            raise ValueError("malformed record")
        return await original(*args, **kwargs)

    monkeypatch.setattr(
        worker_module.NotificationService,
        "create_notification_for_reminder",
        staticmethod(flaky),
    )

    result = await process_due_reminders(session_factory=session_factory, clock=clock)

    assert result.failed == 1
    await db_session.refresh(reminder)
    assert reminder.status == "pending"
