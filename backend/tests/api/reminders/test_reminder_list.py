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


async def test_list_returns_only_current_user_reminders(
    api_app,
    api_client,
    db_session,
) -> None:
    owner = await create_user(db_session)
    member = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    await add_member(db_session, workspace=workspace, user=member)
    todo = await create_todo(db_session, workspace=workspace, creator=owner)
    own = await create_reminder(db_session, todo=todo, user=owner)
    await create_reminder(db_session, todo=todo, user=member)
    await db_session.commit()
    authenticate(api_app, owner)

    response = await api_client.get(f"/api/v1/todos/{todo.id}/reminders")

    assert response.status_code == 200
    body = response.json()
    assert len(body["items"]) == 1
    assert body["items"][0]["id"] == str(own.id)
    assert body["items"][0]["user_id"] == str(owner.id)


async def test_empty_reminder_list(
    api_app,
    api_client,
    db_session,
) -> None:
    owner = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    todo = await create_todo(db_session, workspace=workspace, creator=owner)
    await db_session.commit()
    authenticate(api_app, owner)

    response = await api_client.get(f"/api/v1/todos/{todo.id}/reminders")

    assert response.status_code == 200
    assert response.json() == {"items": []}


async def test_non_member_cannot_list_reminders(
    api_app,
    api_client,
    db_session,
) -> None:
    owner = await create_user(db_session)
    outsider = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    todo = await create_todo(db_session, workspace=workspace, creator=owner)
    await db_session.commit()
    authenticate(api_app, outsider)

    response = await api_client.get(f"/api/v1/todos/{todo.id}/reminders")

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "REMINDER_USER_NOT_MEMBER"


async def test_cancelled_and_processed_reminders_are_returned(
    api_app,
    api_client,
    db_session,
) -> None:
    owner = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    todo = await create_todo(db_session, workspace=workspace, creator=owner)
    await create_reminder(db_session, todo=todo, user=owner, status="cancelled")
    await create_reminder(db_session, todo=todo, user=owner, status="processed")
    await db_session.commit()
    authenticate(api_app, owner)

    response = await api_client.get(f"/api/v1/todos/{todo.id}/reminders")

    assert response.status_code == 200
    statuses = {item["status"] for item in response.json()["items"]}
    assert statuses == {"cancelled", "processed"}


async def test_multiple_manual_reminders_are_supported(
    api_app,
    api_client,
    db_session,
) -> None:
    owner = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    todo = await create_todo(db_session, workspace=workspace, creator=owner)
    now = datetime.now(UTC)
    for hours in (1, 3, 6):
        await create_reminder(
            db_session,
            todo=todo,
            user=owner,
            remind_at=now + timedelta(hours=hours),
        )
    await db_session.commit()
    authenticate(api_app, owner)

    response = await api_client.get(f"/api/v1/todos/{todo.id}/reminders")

    assert response.status_code == 200
    assert len(response.json()["items"]) == 3
