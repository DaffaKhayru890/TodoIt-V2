from __future__ import annotations

from datetime import UTC, datetime, timedelta

from app.common.cursor import encode_cursor
from app.core.config import settings
from tests.conftest import authenticate
from tests.factories import create_notification, create_user


async def test_list_returns_only_own_notifications(
    api_app,
    api_client,
    db_session,
) -> None:
    owner = await create_user(db_session)
    other = await create_user(db_session)
    own = await create_notification(db_session, user=owner, title="Own")
    await create_notification(db_session, user=other, title="Other")
    await db_session.commit()
    authenticate(api_app, owner)

    response = await api_client.get("/api/v1/notifications")

    assert response.status_code == 200
    body = response.json()
    assert len(body["items"]) == 1
    assert body["items"][0]["id"] == str(own.id)
    assert body["page"] == {"limit": 20, "next_cursor": None, "has_more": False}


async def test_empty_notification_list(api_app, api_client, db_session) -> None:
    owner = await create_user(db_session)
    await db_session.commit()
    authenticate(api_app, owner)

    response = await api_client.get("/api/v1/notifications")

    assert response.status_code == 200
    assert response.json()["items"] == []


async def test_read_and_unread_filters(api_app, api_client, db_session) -> None:
    owner = await create_user(db_session)
    unread = await create_notification(db_session, user=owner, is_read=False)
    read = await create_notification(db_session, user=owner, is_read=True)
    await db_session.commit()
    authenticate(api_app, owner)

    unread_response = await api_client.get("/api/v1/notifications?is_read=false")
    read_response = await api_client.get("/api/v1/notifications?is_read=true")

    assert unread_response.status_code == 200
    assert [item["id"] for item in unread_response.json()["items"]] == [str(unread.id)]
    assert read_response.status_code == 200
    assert [item["id"] for item in read_response.json()["items"]] == [str(read.id)]


async def test_cursor_pagination(api_app, api_client, db_session) -> None:
    owner = await create_user(db_session)
    base = datetime(2026, 11, 13, 10, 0, tzinfo=UTC)
    for index in range(5):
        await create_notification(
            db_session,
            user=owner,
            title=f"Notification {index}",
            created_at=base + timedelta(minutes=index),
        )
    await db_session.commit()
    authenticate(api_app, owner)

    first = await api_client.get("/api/v1/notifications?limit=2")
    assert first.status_code == 200
    first_body = first.json()
    assert len(first_body["items"]) == 2
    assert first_body["page"]["has_more"] is True

    second = await api_client.get(
        f"/api/v1/notifications?limit=2&cursor={first_body['page']['next_cursor']}"
    )
    assert second.status_code == 200
    second_body = second.json()
    assert len(second_body["items"]) == 2

    third = await api_client.get(
        f"/api/v1/notifications?limit=2&cursor={second_body['page']['next_cursor']}"
    )
    assert third.status_code == 200
    third_body = third.json()
    assert len(third_body["items"]) == 1
    assert third_body["page"]["has_more"] is False

    ids = [item["id"] for item in first_body["items"] + second_body["items"] + third_body["items"]]
    assert len(ids) == len(set(ids)) == 5


async def test_invalid_cursor_returns_400(api_app, api_client, db_session) -> None:
    owner = await create_user(db_session)
    await db_session.commit()
    authenticate(api_app, owner)

    response = await api_client.get("/api/v1/notifications?cursor=broken")

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_NOTIFICATION_CURSOR"


async def test_cursor_user_mismatch_returns_400(api_app, api_client, db_session) -> None:
    owner = await create_user(db_session)
    other = await create_user(db_session)
    await create_notification(db_session, user=other)
    await db_session.commit()
    authenticate(api_app, owner)

    cursor = encode_cursor(
        {
            "version": 1,
            "created_at": "2026-11-13T10:00:00+00:00",
            "id": str(other.id),
            "user_id": str(other.id),
            "filter_hash": "x",
        },
        secret=settings.pagination_cursor_secret.get_secret_value(),
    )

    response = await api_client.get(f"/api/v1/notifications?cursor={cursor}")

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "NOTIFICATION_CURSOR_USER_MISMATCH"
