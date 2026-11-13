from __future__ import annotations

from datetime import timedelta

from sqlalchemy import select

from app.core.config import settings
from app.services.reminders.models import Reminder
from app.services.reminders.service import ReminderService
from tests.factories import create_reminder, create_todo, create_user, create_workspace


async def _reminders(db_session) -> list[Reminder]:
    result = await db_session.execute(select(Reminder).order_by(Reminder.remind_at.asc()))
    return list(result.scalars().all())


async def test_automatic_reminder_uses_configured_lead_time(
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
        due_at=fixed_now + timedelta(hours=2),
    )
    await db_session.commit()

    reminder = await ReminderService.sync_automatic_reminder_for_todo(
        db_session,
        todo,
        owner.id,
        clock=clock,
    )

    assert reminder is not None
    assert reminder.source == "automatic"
    assert reminder.status == "pending"
    assert reminder.remind_at == todo.due_at - timedelta(
        minutes=settings.default_due_reminder_minutes
    )


async def test_due_date_within_lead_time_schedules_immediately(
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
        due_at=fixed_now + timedelta(minutes=30),
    )
    await db_session.commit()

    reminder = await ReminderService.sync_automatic_reminder_for_todo(
        db_session,
        todo,
        owner.id,
        clock=clock,
    )

    assert reminder is not None
    assert reminder.remind_at == fixed_now


async def test_past_due_date_cancels_pending_automatic_reminder(
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
        due_at=fixed_now - timedelta(minutes=5),
    )
    automatic = await create_reminder(
        db_session,
        todo=todo,
        user=owner,
        source="automatic",
    )
    await db_session.commit()

    reminder = await ReminderService.sync_automatic_reminder_for_todo(
        db_session,
        todo,
        owner.id,
        clock=clock,
    )

    assert reminder is None
    await db_session.refresh(automatic)
    assert automatic.status == "cancelled"


async def test_removing_due_date_cancels_only_automatic_reminder(
    db_session,
    clock,
) -> None:
    owner = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    todo = await create_todo(db_session, workspace=workspace, creator=owner, due_at=None)
    automatic = await create_reminder(
        db_session,
        todo=todo,
        user=owner,
        source="automatic",
    )
    manual = await create_reminder(
        db_session,
        todo=todo,
        user=owner,
        source="manual",
    )
    await db_session.commit()

    await ReminderService.sync_automatic_reminder_for_todo(
        db_session,
        todo,
        owner.id,
        clock=clock,
    )

    await db_session.refresh(automatic)
    await db_session.refresh(manual)
    assert automatic.status == "cancelled"
    assert manual.status == "pending"


async def test_completed_todo_cancels_all_pending_reminders(
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
        due_at=fixed_now + timedelta(hours=2),
    )
    automatic = await create_reminder(db_session, todo=todo, user=owner, source="automatic")
    manual = await create_reminder(db_session, todo=todo, user=owner, source="manual")
    await db_session.commit()

    await ReminderService.sync_automatic_reminder_for_todo(
        db_session,
        todo,
        owner.id,
        clock=clock,
    )

    await db_session.refresh(automatic)
    await db_session.refresh(manual)
    assert automatic.status == "cancelled"
    assert manual.status == "cancelled"


async def test_processed_automatic_reminder_does_not_block_new_schedule(
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
        due_at=fixed_now + timedelta(hours=2),
    )
    await create_reminder(
        db_session,
        todo=todo,
        user=owner,
        source="automatic",
        status="processed",
    )
    await db_session.commit()

    reminder = await ReminderService.sync_automatic_reminder_for_todo(
        db_session,
        todo,
        owner.id,
        clock=clock,
    )

    assert reminder is not None
    assert reminder.status == "pending"
    assert reminder.source == "automatic"


async def test_disabled_automatic_reminders_create_nothing(
    db_session,
    clock,
    fixed_now,
    monkeypatch,
) -> None:
    monkeypatch.setattr(settings, "automatic_due_reminders_enabled", False)
    owner = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    todo = await create_todo(
        db_session,
        workspace=workspace,
        creator=owner,
        due_at=fixed_now + timedelta(hours=2),
    )
    await db_session.commit()

    reminder = await ReminderService.sync_automatic_reminder_for_todo(
        db_session,
        todo,
        owner.id,
        clock=clock,
    )

    assert reminder is None
    assert await _reminders(db_session) == []
