from __future__ import annotations

from datetime import timedelta

import pytest

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
from app.services.reminders.service import ReminderService
from tests.factories import (
    add_member,
    create_reminder,
    create_todo,
    create_user,
    create_workspace,
)


async def test_create_manual_reminder_persists_pending_reminder(
    db_session,
    clock,
    future_time,
) -> None:
    owner = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    todo = await create_todo(db_session, workspace=workspace, creator=owner)
    await db_session.commit()

    reminder = await ReminderService.create_manual_reminder(
        db_session,
        todo_id=todo.id,
        user_id=owner.id,
        remind_at=future_time,
        clock=clock,
    )

    assert reminder.source == "manual"
    assert reminder.status == "pending"
    assert reminder.user_id == owner.id
    assert reminder.remind_at == future_time


async def test_naive_reminder_time_is_rejected(db_session, clock, fixed_now) -> None:
    owner = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    todo = await create_todo(db_session, workspace=workspace, creator=owner)
    await db_session.commit()

    with pytest.raises(ReminderInvalidTimeError):
        await ReminderService.create_manual_reminder(
            db_session,
            todo_id=todo.id,
            user_id=owner.id,
            remind_at=fixed_now.replace(tzinfo=None),
            clock=clock,
        )


async def test_past_reminder_time_is_rejected(db_session, clock, fixed_now) -> None:
    owner = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    todo = await create_todo(db_session, workspace=workspace, creator=owner)
    await db_session.commit()

    with pytest.raises(ReminderInvalidTimeError):
        await ReminderService.create_manual_reminder(
            db_session,
            todo_id=todo.id,
            user_id=owner.id,
            remind_at=fixed_now - timedelta(minutes=1),
            clock=clock,
        )


async def test_duplicate_pending_manual_reminder_is_rejected(
    db_session,
    clock,
    future_time,
) -> None:
    owner = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    todo = await create_todo(db_session, workspace=workspace, creator=owner)
    await db_session.commit()

    await ReminderService.create_manual_reminder(
        db_session,
        todo_id=todo.id,
        user_id=owner.id,
        remind_at=future_time,
        clock=clock,
    )

    with pytest.raises(ReminderDuplicateError):
        await ReminderService.create_manual_reminder(
            db_session,
            todo_id=todo.id,
            user_id=owner.id,
            remind_at=future_time,
            clock=clock,
        )


async def test_non_member_cannot_create_reminder(
    db_session,
    clock,
    future_time,
) -> None:
    owner = await create_user(db_session)
    outsider = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    todo = await create_todo(db_session, workspace=workspace, creator=owner)
    await db_session.commit()

    with pytest.raises(ReminderUserNotMemberError):
        await ReminderService.create_manual_reminder(
            db_session,
            todo_id=todo.id,
            user_id=outsider.id,
            remind_at=future_time,
            clock=clock,
        )


async def test_unknown_todo_is_rejected(db_session, clock, future_time) -> None:
    owner = await create_user(db_session)
    await db_session.commit()

    with pytest.raises(ReminderTodoNotFoundError):
        await ReminderService.create_manual_reminder(
            db_session,
            todo_id=owner.id,
            user_id=owner.id,
            remind_at=future_time,
            clock=clock,
        )


async def test_member_can_create_reminder_for_shared_todo(
    db_session,
    clock,
    future_time,
) -> None:
    owner = await create_user(db_session)
    member = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    await add_member(db_session, workspace=workspace, user=member)
    todo = await create_todo(db_session, workspace=workspace, creator=owner)
    await db_session.commit()

    reminder = await ReminderService.create_manual_reminder(
        db_session,
        todo_id=todo.id,
        user_id=member.id,
        remind_at=future_time,
        clock=clock,
    )

    assert reminder.user_id == member.id
    assert reminder.todo_id == todo.id


async def test_list_only_returns_current_user_reminders(
    db_session,
    clock,
    future_time,
) -> None:
    owner = await create_user(db_session)
    member = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    await add_member(db_session, workspace=workspace, user=member)
    todo = await create_todo(db_session, workspace=workspace, creator=owner)
    await db_session.commit()

    await ReminderService.create_manual_reminder(
        db_session,
        todo_id=todo.id,
        user_id=owner.id,
        remind_at=future_time,
        clock=clock,
    )
    await ReminderService.create_manual_reminder(
        db_session,
        todo_id=todo.id,
        user_id=member.id,
        remind_at=future_time,
        clock=clock,
    )

    owner_reminders = await ReminderService.list_for_todo(
        db_session,
        todo_id=todo.id,
        user_id=owner.id,
    )
    member_reminders = await ReminderService.list_for_todo(
        db_session,
        todo_id=todo.id,
        user_id=member.id,
    )

    assert len(owner_reminders) == 1
    assert owner_reminders[0].user_id == owner.id
    assert len(member_reminders) == 1
    assert member_reminders[0].user_id == member.id


async def test_update_rejects_other_user_reminder(
    db_session,
    clock,
    future_time,
) -> None:
    owner = await create_user(db_session)
    member = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    await add_member(db_session, workspace=workspace, user=member)
    todo = await create_todo(db_session, workspace=workspace, creator=owner)
    reminder = await create_reminder(db_session, todo=todo, user=owner)
    await db_session.commit()

    with pytest.raises(ReminderPermissionDeniedError):
        await ReminderService.update_reminder(
            db_session,
            reminder_id=reminder.id,
            user_id=member.id,
            remind_at=future_time,
            clock=clock,
        )


async def test_update_rejects_automatic_reminder(
    db_session,
    clock,
    future_time,
) -> None:
    owner = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    todo = await create_todo(db_session, workspace=workspace, creator=owner)
    reminder = await create_reminder(
        db_session,
        todo=todo,
        user=owner,
        source="automatic",
    )
    await db_session.commit()

    with pytest.raises(ReminderInvalidStateError):
        await ReminderService.update_reminder(
            db_session,
            reminder_id=reminder.id,
            user_id=owner.id,
            remind_at=future_time,
            clock=clock,
        )


async def test_update_rejects_processed_and_cancelled_reminders(
    db_session,
    clock,
    future_time,
) -> None:
    owner = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    todo = await create_todo(db_session, workspace=workspace, creator=owner)
    processed = await create_reminder(db_session, todo=todo, user=owner, status="processed")
    cancelled = await create_reminder(db_session, todo=todo, user=owner, status="cancelled")
    await db_session.commit()

    with pytest.raises(ReminderAlreadyProcessedError):
        await ReminderService.update_reminder(
            db_session,
            reminder_id=processed.id,
            user_id=owner.id,
            remind_at=future_time,
            clock=clock,
        )
    with pytest.raises(ReminderAlreadyCancelledError):
        await ReminderService.update_reminder(
            db_session,
            reminder_id=cancelled.id,
            user_id=owner.id,
            remind_at=future_time,
            clock=clock,
        )


async def test_update_unknown_reminder_is_rejected(db_session, clock, future_time) -> None:
    owner = await create_user(db_session)
    await db_session.commit()

    with pytest.raises(ReminderNotFoundError):
        await ReminderService.update_reminder(
            db_session,
            reminder_id=owner.id,
            user_id=owner.id,
            remind_at=future_time,
            clock=clock,
        )


async def test_cancel_is_idempotent_and_processed_cannot_be_cancelled(
    db_session,
    clock,
) -> None:
    owner = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    todo = await create_todo(db_session, workspace=workspace, creator=owner)
    reminder = await create_reminder(db_session, todo=todo, user=owner)
    processed = await create_reminder(db_session, todo=todo, user=owner, status="processed")
    await db_session.commit()

    await ReminderService.cancel_reminder(
        db_session,
        reminder_id=reminder.id,
        user_id=owner.id,
        clock=clock,
    )
    await ReminderService.cancel_reminder(
        db_session,
        reminder_id=reminder.id,
        user_id=owner.id,
        clock=clock,
    )

    assert reminder.status == "cancelled"

    with pytest.raises(ReminderAlreadyProcessedError):
        await ReminderService.cancel_reminder(
            db_session,
            reminder_id=processed.id,
            user_id=owner.id,
            clock=clock,
        )
