from __future__ import annotations

from datetime import UTC, datetime, timedelta

from tests.conftest import authenticate
from tests.factories import (
    add_member,
    create_reminder,
    create_todo,
    create_user,
    create_workspace,
)


def _future() -> str:
    return (datetime.now(UTC) + timedelta(hours=4)).isoformat()


async def test_update_pending_manual_reminder(
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

    new_time = _future()
    response = await api_client.patch(
        f"/api/v1/reminders/{reminder.id}",
        json={"remind_at": new_time},
    )

    assert response.status_code == 200
    assert response.json()["remind_at"].startswith(new_time[:19])


async def test_update_other_users_reminder_is_denied(
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

    response = await api_client.patch(
        f"/api/v1/reminders/{reminder.id}",
        json={"remind_at": _future()},
    )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "REMINDER_PERMISSION_DENIED"


async def test_update_automatic_reminder_is_rejected(
    api_app,
    api_client,
    db_session,
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
    authenticate(api_app, owner)

    response = await api_client.patch(
        f"/api/v1/reminders/{reminder.id}",
        json={"remind_at": _future()},
    )

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "REMINDER_INVALID_STATE"


async def test_update_processed_reminder_is_rejected(
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

    response = await api_client.patch(
        f"/api/v1/reminders/{reminder.id}",
        json={"remind_at": _future()},
    )

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "REMINDER_ALREADY_PROCESSED"


async def test_update_cancelled_reminder_is_rejected(
    api_app,
    api_client,
    db_session,
) -> None:
    owner = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    todo = await create_todo(db_session, workspace=workspace, creator=owner)
    reminder = await create_reminder(db_session, todo=todo, user=owner, status="cancelled")
    await db_session.commit()
    authenticate(api_app, owner)

    response = await api_client.patch(
        f"/api/v1/reminders/{reminder.id}",
        json={"remind_at": _future()},
    )

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "REMINDER_ALREADY_CANCELLED"


async def test_update_with_past_or_naive_time_is_rejected(
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

    past = await api_client.patch(
        f"/api/v1/reminders/{reminder.id}",
        json={"remind_at": (datetime.now(UTC) - timedelta(minutes=1)).isoformat()},
    )
    naive = await api_client.patch(
        f"/api/v1/reminders/{reminder.id}",
        json={"remind_at": "2026-12-01T10:00:00"},
    )

    assert past.status_code == 422
    assert past.json()["error"]["code"] == "REMINDER_INVALID_TIME"
    assert naive.status_code == 422
    assert naive.json()["error"]["code"] == "REMINDER_INVALID_TIME"


async def test_update_cannot_change_owner_todo_or_source(
    api_app,
    api_client,
    db_session,
) -> None:
    owner = await create_user(db_session)
    other = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    todo = await create_todo(db_session, workspace=workspace, creator=owner)
    reminder = await create_reminder(db_session, todo=todo, user=owner)
    await db_session.commit()
    authenticate(api_app, owner)

    response = await api_client.patch(
        f"/api/v1/reminders/{reminder.id}",
        json={
            "remind_at": _future(),
            "user_id": str(other.id),
            "todo_id": str(other.id),
            "source": "automatic",
            "status": "processed",
        },
    )

    assert response.status_code == 422
