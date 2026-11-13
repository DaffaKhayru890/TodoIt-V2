from __future__ import annotations

from tests.conftest import authenticate
from tests.factories import create_notification, create_user


async def test_mark_own_notification_as_read(api_app, api_client, db_session) -> None:
    owner = await create_user(db_session)
    notification = await create_notification(db_session, user=owner, is_read=False)
    await db_session.commit()
    authenticate(api_app, owner)

    response = await api_client.post(f"/api/v1/notifications/{notification.id}/read")

    assert response.status_code == 200
    body = response.json()
    assert body["is_read"] is True
    assert body["read_at"] is not None
    await db_session.refresh(notification)
    assert notification.is_read is True
    assert notification.read_at is not None


async def test_repeated_read_is_idempotent_and_preserves_timestamp(
    api_app,
    api_client,
    db_session,
) -> None:
    owner = await create_user(db_session)
    notification = await create_notification(db_session, user=owner, is_read=False)
    await db_session.commit()
    authenticate(api_app, owner)

    first = await api_client.post(f"/api/v1/notifications/{notification.id}/read")
    second = await api_client.post(f"/api/v1/notifications/{notification.id}/read")

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["read_at"] == second.json()["read_at"]


async def test_mark_other_users_notification_is_rejected(
    api_app,
    api_client,
    db_session,
) -> None:
    owner = await create_user(db_session)
    other = await create_user(db_session)
    notification = await create_notification(db_session, user=other, is_read=False)
    await db_session.commit()
    authenticate(api_app, owner)

    response = await api_client.post(f"/api/v1/notifications/{notification.id}/read")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOTIFICATION_NOT_FOUND"
    await db_session.refresh(notification)
    assert notification.is_read is False
