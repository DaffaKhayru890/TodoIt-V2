from __future__ import annotations

from datetime import timedelta

import pytest
from sqlalchemy import select

from app.services.notifications.models import Notification
from app.services.reminders.models import Reminder
from app.services.reminders.service import ReminderService
from app.services.todos.models import Todo
from app.services.todos.service import TodoService
from tests.factories import create_notification, create_reminder, create_user, create_workspace


async def _reminders_for_todo(db_session, todo_id):
    result = await db_session.execute(
        select(Reminder).where(Reminder.todo_id == todo_id).order_by(Reminder.created_at.asc())
    )
    return list(result.scalars().all())


async def test_todo_creation_with_due_date_creates_automatic_reminder(
    db_session,
    clock,
    fixed_now,
) -> None:
    owner = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    await db_session.commit()

    todo = await TodoService.create_todo(
        db_session,
        workspace_id=workspace.id,
        user_id=owner.id,
        title="Finish backend project",
        description=None,
        due_at=fixed_now + timedelta(hours=3),
        clock=clock,
    )

    reminders = await _reminders_for_todo(db_session, todo.id)
    assert len(reminders) == 1
    assert reminders[0].source == "automatic"
    assert reminders[0].user_id == owner.id
    assert reminders[0].status == "pending"


async def test_todo_creation_without_due_date_creates_no_reminder(
    db_session,
    clock,
) -> None:
    owner = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    await db_session.commit()

    todo = await TodoService.create_todo(
        db_session,
        workspace_id=workspace.id,
        user_id=owner.id,
        title="No deadline",
        description=None,
        due_at=None,
        clock=clock,
    )

    assert await _reminders_for_todo(db_session, todo.id) == []


async def test_due_date_update_reschedules_pending_automatic_reminder(
    db_session,
    clock,
    fixed_now,
) -> None:
    owner = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    await db_session.commit()
    todo = await TodoService.create_todo(
        db_session,
        workspace_id=workspace.id,
        user_id=owner.id,
        title="Reschedule me",
        description=None,
        due_at=fixed_now + timedelta(hours=3),
        clock=clock,
    )

    updated_due = fixed_now + timedelta(hours=5)
    await TodoService.update_todo(
        db_session,
        workspace_id=workspace.id,
        user_id=owner.id,
        todo_id=todo.id,
        title=None,
        description=None,
        status=None,
        priority=None,
        due_at=updated_due,
        tag_ids=None,
        label_ids=None,
        due_at_provided=True,
        clock=clock,
    )

    reminders = await _reminders_for_todo(db_session, todo.id)
    assert len(reminders) == 1
    assert reminders[0].remind_at == updated_due - timedelta(minutes=60)


async def test_clearing_due_date_cancels_automatic_but_keeps_manual(
    db_session,
    clock,
    fixed_now,
) -> None:
    owner = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    await db_session.commit()
    todo = await TodoService.create_todo(
        db_session,
        workspace_id=workspace.id,
        user_id=owner.id,
        title="Clear deadline",
        description=None,
        due_at=fixed_now + timedelta(hours=3),
        clock=clock,
    )
    manual = await create_reminder(
        db_session,
        todo=todo,
        user=owner,
        source="manual",
        remind_at=fixed_now + timedelta(hours=1),
    )
    await db_session.commit()

    await TodoService.update_todo(
        db_session,
        workspace_id=workspace.id,
        user_id=owner.id,
        todo_id=todo.id,
        title=None,
        description=None,
        status=None,
        priority=None,
        due_at=None,
        tag_ids=None,
        label_ids=None,
        due_at_provided=True,
        clock=clock,
    )

    reminders = await _reminders_for_todo(db_session, todo.id)
    automatic = [item for item in reminders if item.source == "automatic"]
    assert automatic[0].status == "cancelled"
    await db_session.refresh(manual)
    assert manual.status == "pending"


async def test_completing_todo_cancels_all_pending_reminders(
    db_session,
    clock,
    fixed_now,
) -> None:
    owner = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    await db_session.commit()
    todo = await TodoService.create_todo(
        db_session,
        workspace_id=workspace.id,
        user_id=owner.id,
        title="Complete me",
        description=None,
        due_at=fixed_now + timedelta(hours=3),
        clock=clock,
    )
    manual = await create_reminder(
        db_session,
        todo=todo,
        user=owner,
        source="manual",
        remind_at=fixed_now + timedelta(hours=1),
    )
    await db_session.commit()

    await TodoService.update_todo(
        db_session,
        workspace_id=workspace.id,
        user_id=owner.id,
        todo_id=todo.id,
        title=None,
        description=None,
        status="completed",
        priority=None,
        due_at=None,
        tag_ids=None,
        label_ids=None,
        due_at_provided=False,
        clock=clock,
    )

    reminders = await _reminders_for_todo(db_session, todo.id)
    assert reminders
    assert all(item.status == "cancelled" for item in reminders)
    await db_session.refresh(manual)
    assert manual.status == "cancelled"


async def test_reopening_todo_schedules_new_automatic_reminder(
    db_session,
    clock,
    fixed_now,
) -> None:
    owner = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    await db_session.commit()
    todo = await TodoService.create_todo(
        db_session,
        workspace_id=workspace.id,
        user_id=owner.id,
        title="Reopen me",
        description=None,
        due_at=fixed_now + timedelta(hours=3),
        clock=clock,
    )
    await TodoService.update_todo(
        db_session,
        workspace_id=workspace.id,
        user_id=owner.id,
        todo_id=todo.id,
        title=None,
        description=None,
        status="completed",
        priority=None,
        due_at=None,
        tag_ids=None,
        label_ids=None,
        due_at_provided=False,
        clock=clock,
    )

    await TodoService.update_todo(
        db_session,
        workspace_id=workspace.id,
        user_id=owner.id,
        todo_id=todo.id,
        title=None,
        description=None,
        status="todo",
        priority=None,
        due_at=None,
        tag_ids=None,
        label_ids=None,
        due_at_provided=False,
        clock=clock,
    )

    reminders = await _reminders_for_todo(db_session, todo.id)
    pending = [item for item in reminders if item.status == "pending"]
    assert len(pending) == 1
    assert pending[0].source == "automatic"


async def test_deleting_todo_removes_reminders_but_preserves_notification_history(
    db_session,
    clock,
    fixed_now,
) -> None:
    owner = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    await db_session.commit()
    todo = await TodoService.create_todo(
        db_session,
        workspace_id=workspace.id,
        user_id=owner.id,
        title="Delete me",
        description=None,
        due_at=fixed_now + timedelta(hours=3),
        clock=clock,
    )
    reminder = (await _reminders_for_todo(db_session, todo.id))[0]
    notification = await create_notification(
        db_session,
        user=owner,
        todo=todo,
        reminder=reminder,
        title="Todo Reminder",
        message="Reminder: Delete me",
    )
    await db_session.commit()

    await TodoService.delete_todo(
        db_session,
        workspace_id=workspace.id,
        user_id=owner.id,
        todo_id=todo.id,
        clock=clock,
    )

    assert await db_session.get(Todo, todo.id) is None
    assert await _reminders_for_todo(db_session, todo.id) == []

    result = await db_session.execute(
        select(Notification).where(Notification.id == notification.id)
    )
    preserved = result.scalar_one()
    await db_session.refresh(preserved)
    assert preserved.title == "Todo Reminder"
    assert preserved.message == "Reminder: Delete me"
    assert preserved.todo_id is None
    assert preserved.reminder_id is None


async def test_reminder_failure_rolls_back_todo_creation(
    db_session,
    clock,
    fixed_now,
    monkeypatch,
) -> None:
    owner = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    await db_session.commit()

    async def fail_sync(*args, **kwargs):
        raise RuntimeError("simulated reminder failure")

    monkeypatch.setattr(
        ReminderService,
        "sync_automatic_reminder_for_todo",
        staticmethod(fail_sync),
    )

    with pytest.raises(RuntimeError):
        await TodoService.create_todo(
            db_session,
            workspace_id=workspace.id,
            user_id=owner.id,
            title="Rollback me",
            description=None,
            due_at=fixed_now + timedelta(hours=3),
            clock=clock,
        )

    result = await db_session.execute(select(Todo).where(Todo.title == "Rollback me"))
    assert result.scalar_one_or_none() is None
