from __future__ import annotations

from datetime import UTC, datetime, timedelta

from tests.conftest import authenticate
from tests.factories import create_todo, create_user, create_workspace


async def test_create_manual_reminder(
    api_app,
    api_client,
    db_session,
    fixed_now,
) -> None:
    owner = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    todo = await create_todo(db_session, workspace=workspace, creator=owner)
    await db_session.commit()
    authenticate(api_app, owner)

    response = await api_client.post(
        f"/api/v1/todos/{todo.id}/reminders",
        json={"remind_at": (datetime.now(UTC) + timedelta(hours=2)).isoformat()},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["source"] == "manual"
    assert body["status"] == "pending"
    assert body["user_id"] == str(owner.id)
    assert body["todo_id"] == str(todo.id)


async def test_naive_reminder_time_is_rejected(
    api_app,
    api_client,
    db_session,
    fixed_now,
) -> None:
    owner = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    todo = await create_todo(db_session, workspace=workspace, creator=owner)
    await db_session.commit()
    authenticate(api_app, owner)

    response = await api_client.post(
        f"/api/v1/todos/{todo.id}/reminders",
        json={"remind_at": "2026-11-15T10:00:00"},
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "REMINDER_INVALID_TIME"


async def test_past_reminder_time_is_rejected(
    api_app,
    api_client,
    db_session,
    fixed_now,
) -> None:
    owner = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    todo = await create_todo(db_session, workspace=workspace, creator=owner)
    await db_session.commit()
    authenticate(api_app, owner)

    response = await api_client.post(
        f"/api/v1/todos/{todo.id}/reminders",
        json={"remind_at": (datetime.now(UTC) - timedelta(minutes=1)).isoformat()},
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "REMINDER_INVALID_TIME"


async def test_client_cannot_supply_user_id_or_source(
    api_app,
    api_client,
    db_session,
    fixed_now,
) -> None:
    owner = await create_user(db_session)
    other = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    todo = await create_todo(db_session, workspace=workspace, creator=owner)
    await db_session.commit()
    authenticate(api_app, owner)

    response = await api_client.post(
        f"/api/v1/todos/{todo.id}/reminders",
        json={
            "remind_at": (datetime.now(UTC) + timedelta(hours=2)).isoformat(),
            "user_id": str(other.id),
            "source": "automatic",
            "status": "processed",
        },
    )

    assert response.status_code == 422


async def test_non_member_cannot_create_reminder(
    api_app,
    api_client,
    db_session,
    fixed_now,
) -> None:
    owner = await create_user(db_session)
    outsider = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    todo = await create_todo(db_session, workspace=workspace, creator=owner)
    await db_session.commit()
    authenticate(api_app, outsider)

    response = await api_client.post(
        f"/api/v1/todos/{todo.id}/reminders",
        json={"remind_at": (datetime.now(UTC) + timedelta(hours=2)).isoformat()},
    )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "REMINDER_USER_NOT_MEMBER"


async def test_unknown_todo_returns_404(
    api_app,
    api_client,
    db_session,
    fixed_now,
) -> None:
    owner = await create_user(db_session)
    await db_session.commit()
    authenticate(api_app, owner)

    response = await api_client.post(
        f"/api/v1/todos/{owner.id}/reminders",
        json={"remind_at": (datetime.now(UTC) + timedelta(hours=2)).isoformat()},
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "REMINDER_TODO_NOT_FOUND"


async def test_duplicate_manual_reminder_is_rejected(
    api_app,
    api_client,
    db_session,
    fixed_now,
) -> None:
    owner = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    todo = await create_todo(db_session, workspace=workspace, creator=owner)
    await db_session.commit()
    authenticate(api_app, owner)
    payload = {"remind_at": (datetime.now(UTC) + timedelta(hours=2)).isoformat()}

    first = await api_client.post(f"/api/v1/todos/{todo.id}/reminders", json=payload)
    second = await api_client.post(f"/api/v1/todos/{todo.id}/reminders", json=payload)

    assert first.status_code == 201
    assert second.status_code == 409
    assert second.json()["error"]["code"] == "REMINDER_DUPLICATE"
