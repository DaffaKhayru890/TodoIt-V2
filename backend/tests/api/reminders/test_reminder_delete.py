from __future__ import annotations

from sqlalchemy import select

from app.services.notifications.models import Notification
from tests.conftest import authenticate
from tests.factories import (
    add_member,
    create_notification,
    create_reminder,
    create_todo,
    create_user,
    create_workspace,
)


async def test_cancel_pending_reminder(
    api_app,
    api_client,
    db_session,
) -> None:
    owner = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    todo = await create_todo(db_session, workspace=workspace, creator=owner)
    reminder = await create_reminder(db_session, todo=todo, user=owner)
    await db_session.commit()
    authenticate(api_app, owner)

    response = await api_client.delete(f"/api/v1/reminders/{reminder.id}")

    assert response.status_code == 204
    await db_session.refresh(reminder)
    assert reminder.status == "cancelled"
    assert await db_session.get(type(todo), todo.id) is not None


async def test_cancel_is_idempotent(
    api_app,
    api_client,
    db_session,
) -> None:
    owner = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    todo = await create_todo(db_session, workspace=workspace, creator=owner)
    reminder = await create_reminder(db_session, todo=todo, user=owner)
    await db_session.commit()
    authenticate(api_app, owner)

    first = await api_client.delete(f"/api/v1/reminders/{reminder.id}")
    second = await api_client.delete(f"/api/v1/reminders/{reminder.id}")

    assert first.status_code == 204
    assert second.status_code == 204


async def test_cancel_other_users_reminder_is_denied(
    api_app,
    api_client,
    db_session,
) -> None:
    owner = await create_user(db_session)
    member = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    await add_member(db_session, workspace=workspace, user=member)
    todo = await create_todo(db_session, workspace=workspace, creator=owner)
    reminder = await create_reminder(db_session, todo=todo, user=owner)
    await db_session.commit()
    authenticate(api_app, member)

    response = await api_client.delete(f"/api/v1/reminders/{reminder.id}")

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "REMINDER_PERMISSION_DENIED"


async def test_processed_reminder_cannot_be_cancelled(
    api_app,
    api_client,
    db_session,
) -> None:
    owner = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    todo = await create_todo(db_session, workspace=workspace, creator=owner)
    reminder = await create_reminder(db_session, todo=todo, user=owner, status="processed")
    await db_session.commit()
    authenticate(api_app, owner)

    response = await api_client.delete(f"/api/v1/reminders/{reminder.id}")

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "REMINDER_ALREADY_PROCESSED"


async def test_cancellation_preserves_notification_history(
    api_app,
    api_client,
    db_session,
) -> None:
    owner = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    todo = await create_todo(db_session, workspace=workspace, creator=owner)
    reminder = await create_reminder(db_session, todo=todo, user=owner)
    notification = await create_notification(
        db_session,
        user=owner,
        todo=todo,
        reminder=reminder,
        title="Todo Reminder",
        message="Reminder: keep me",
    )
    await db_session.commit()
    authenticate(api_app, owner)

    response = await api_client.delete(f"/api/v1/reminders/{reminder.id}")

    assert response.status_code == 204
    result = await db_session.execute(
        select(Notification).where(Notification.id == notification.id)
    )
    preserved = result.scalar_one()
    assert preserved.title == "Todo Reminder"
    assert preserved.message == "Reminder: keep me"
