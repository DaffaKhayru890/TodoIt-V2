from __future__ import annotations

from tests.conftest import authenticate
from tests.factories import create_notification, create_user


async def test_get_own_notification(api_app, api_client, db_session) -> None:
    owner = await create_user(db_session)
    notification = await create_notification(db_session, user=owner, title="Own detail")
    await db_session.commit()
    authenticate(api_app, owner)

    response = await api_client.get(f"/api/v1/notifications/{notification.id}")

    assert response.status_code == 200
    assert response.json()["id"] == str(notification.id)
    assert response.json()["title"] == "Own detail"


async def test_get_other_users_notification_returns_404(
    api_app,
    api_client,
    db_session,
) -> None:
    owner = await create_user(db_session)
    other = await create_user(db_session)
    notification = await create_notification(db_session, user=other)
    await db_session.commit()
    authenticate(api_app, owner)

    response = await api_client.get(f"/api/v1/notifications/{notification.id}")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOTIFICATION_NOT_FOUND"


async def test_get_unknown_notification_returns_404(
    api_app,
    api_client,
    db_session,
) -> None:
    owner = await create_user(db_session)
    await db_session.commit()
    authenticate(api_app, owner)

    response = await api_client.get(f"/api/v1/notifications/{owner.id}")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOTIFICATION_NOT_FOUND"
