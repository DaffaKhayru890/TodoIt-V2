from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

from app.common.cursor import encode_cursor
from app.core.config import settings
from app.core.exceptions import (
    ApiError,
    InvalidNotificationCursorError,
    NotificationCursorSignatureInvalidError,
    NotificationCursorUserMismatchError,
)
from app.services.notifications.service import NotificationService
from tests.factories import create_notification, create_user


async def _seed_notifications(db_session, user, count: int = 5):
    base = datetime(2026, 11, 13, 10, 0, tzinfo=UTC)
    notifications = []
    for index in range(count):
        notifications.append(
            await create_notification(
                db_session,
                user=user,
                title=f"Notification {index}",
                created_at=base + timedelta(minutes=index),
            )
        )
    await db_session.commit()
    return notifications


async def test_first_page_and_next_page_have_no_duplicates(db_session) -> None:
    user = await create_user(db_session)
    await _seed_notifications(db_session, user, 5)

    first_items, first_cursor, first_has_more = await NotificationService.list_notifications(
        db_session,
        user_id=user.id,
        limit=2,
    )
    assert len(first_items) == 2
    assert first_has_more is True
    assert first_cursor is not None

    second_items, second_cursor, second_has_more = await NotificationService.list_notifications(
        db_session,
        user_id=user.id,
        limit=2,
        cursor=first_cursor,
    )
    assert len(second_items) == 2
    assert second_has_more is True
    assert second_cursor is not None

    third_items, third_cursor, third_has_more = await NotificationService.list_notifications(
        db_session,
        user_id=user.id,
        limit=2,
        cursor=second_cursor,
    )
    assert len(third_items) == 1
    assert third_has_more is False
    assert third_cursor is None

    all_ids = [item.id for item in first_items + second_items + third_items]
    assert len(all_ids) == len(set(all_ids)) == 5


async def test_empty_page(db_session) -> None:
    user = await create_user(db_session)
    await db_session.commit()

    items, cursor, has_more = await NotificationService.list_notifications(
        db_session,
        user_id=user.id,
    )

    assert items == []
    assert cursor is None
    assert has_more is False


async def test_same_created_at_uses_uuid_tie_breaker(db_session) -> None:
    user = await create_user(db_session)
    created_at = datetime(2026, 11, 13, 10, 0, tzinfo=UTC)
    for index in range(3):
        await create_notification(
            db_session,
            user=user,
            title=f"Tie {index}",
            created_at=created_at,
        )
    await db_session.commit()

    seen: list = []
    cursor = None
    for _ in range(3):
        items, cursor, has_more = await NotificationService.list_notifications(
            db_session,
            user_id=user.id,
            limit=1,
            cursor=cursor,
        )
        seen.extend(item.id for item in items)
        if not has_more:
            break

    assert len(seen) == len(set(seen)) == 3


async def test_read_filter_is_bound_to_cursor(db_session) -> None:
    user = await create_user(db_session)
    await _seed_notifications(db_session, user, 3)

    _, cursor, _ = await NotificationService.list_notifications(
        db_session,
        user_id=user.id,
        limit=1,
    )

    with pytest.raises(InvalidNotificationCursorError):
        await NotificationService.list_notifications(
            db_session,
            user_id=user.id,
            limit=1,
            is_read=False,
            cursor=cursor,
        )


async def test_cursor_is_bound_to_user(db_session) -> None:
    user_a = await create_user(db_session)
    user_b = await create_user(db_session)
    await _seed_notifications(db_session, user_a, 3)
    await _seed_notifications(db_session, user_b, 3)

    _, cursor, _ = await NotificationService.list_notifications(
        db_session,
        user_id=user_a.id,
        limit=1,
    )

    with pytest.raises(NotificationCursorUserMismatchError):
        await NotificationService.list_notifications(
            db_session,
            user_id=user_b.id,
            limit=1,
            cursor=cursor,
        )


async def test_invalid_cursor_format_is_rejected(db_session) -> None:
    user = await create_user(db_session)
    await db_session.commit()

    with pytest.raises(InvalidNotificationCursorError):
        await NotificationService.list_notifications(
            db_session,
            user_id=user.id,
            cursor="not-a-cursor",
        )


async def test_tampered_cursor_signature_is_rejected(db_session) -> None:
    user = await create_user(db_session)
    await _seed_notifications(db_session, user, 2)
    _, cursor, _ = await NotificationService.list_notifications(
        db_session,
        user_id=user.id,
        limit=1,
    )
    assert cursor is not None
    payload_part, signature_part = cursor.split(".", 1)
    replacement = "a" if signature_part[0] != "a" else "b"
    tampered = f"{payload_part}.{replacement}{signature_part[1:]}"

    with pytest.raises(NotificationCursorSignatureInvalidError):
        await NotificationService.list_notifications(
            db_session,
            user_id=user.id,
            cursor=tampered,
        )


async def test_unsupported_cursor_version_is_rejected(db_session) -> None:
    user = await create_user(db_session)
    await db_session.commit()
    cursor = encode_cursor(
        {
            "version": 99,
            "created_at": "2026-11-13T10:00:00+00:00",
            "id": str(user.id),
            "user_id": str(user.id),
            "filter_hash": "x",
        },
        secret=settings.pagination_cursor_secret.get_secret_value(),
    )

    with pytest.raises(InvalidNotificationCursorError):
        await NotificationService.list_notifications(
            db_session,
            user_id=user.id,
            cursor=cursor,
        )


@pytest.mark.parametrize("limit", [0, 101])
async def test_invalid_limit_is_rejected(db_session, limit) -> None:
    user = await create_user(db_session)
    await db_session.commit()

    with pytest.raises(ApiError) as exc_info:
        await NotificationService.list_notifications(
            db_session,
            user_id=user.id,
            limit=limit,
        )
    assert exc_info.value.code == "INVALID_NOTIFICATION_FILTER"


async def test_unread_filter_returns_only_unread(db_session) -> None:
    user = await create_user(db_session)
    await create_notification(db_session, user=user, is_read=False)
    await create_notification(db_session, user=user, is_read=True)
    await db_session.commit()

    items, _, _ = await NotificationService.list_notifications(
        db_session,
        user_id=user.id,
        is_read=False,
    )

    assert len(items) == 1
    assert items[0].is_read is False
