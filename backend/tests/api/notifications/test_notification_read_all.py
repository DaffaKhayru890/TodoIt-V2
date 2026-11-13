from __future__ import annotations

from sqlalchemy import select

from app.services.notifications.models import Notification
from tests.conftest import authenticate
from tests.factories import create_notification, create_user


async def test_mark_all_read_updates_only_current_user(
    api_app,
    api_client,
    db_session,
) -> None:
    owner = await create_user(db_session)
    other = await create_user(db_session)
    unread_a = await create_notification(db_session, user=owner, is_read=False)
    unread_b = await create_notification(db_session, user=owner, is_read=False)
    already_read = await create_notification(db_session, user=owner, is_read=True)
    other_unread = await create_notification(db_session, user=other, is_read=False)
    await db_session.commit()
    original_read_at = already_read.read_at
    authenticate(api_app, owner)

    response = await api_client.post("/api/v1/notifications/read-all")

    assert response.status_code == 200
    assert response.json() == {"updated_count": 2}

    for notification in (unread_a, unread_b):
        await db_session.refresh(notification)
        assert notification.is_read is True
        assert notification.read_at is not None
    await db_session.refresh(already_read)
    assert already_read.read_at == original_read_at
    await db_session.refresh(other_unread)
    assert other_unread.is_read is False
    assert other_unread.read_at is None


async def test_mark_all_read_is_idempotent(api_app, api_client, db_session) -> None:
    owner = await create_user(db_session)
    await create_notification(db_session, user=owner, is_read=False)
    await db_session.commit()
    authenticate(api_app, owner)

    first = await api_client.post("/api/v1/notifications/read-all")
    second = await api_client.post("/api/v1/notifications/read-all")

    assert first.status_code == 200
    assert first.json() == {"updated_count": 1}
    assert second.status_code == 200
    assert second.json() == {"updated_count": 0}

    result = await db_session.execute(select(Notification).where(Notification.user_id == owner.id))
    notifications = list(result.scalars().all())
    assert all(item.is_read for item in notifications)
    assert all(item.read_at is not None for item in notifications)
