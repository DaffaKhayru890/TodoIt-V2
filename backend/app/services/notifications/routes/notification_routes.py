from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Path, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.services.auth.dependencies import get_current_user
from app.services.notifications.controllers.notification_controller import (
    NotificationController,
)
from app.services.notifications.schemas import (
    MarkAllReadResponse,
    NotificationListPage,
    NotificationListResponse,
    NotificationResponse,
)
from app.services.users.models import User

router = APIRouter(prefix="/api/v1", tags=["Notifications"])

_NOTIFICATION_EXAMPLE = {
    "id": "7e4f0e0e-2e8d-4b4b-9f1e-9f8b2f6b8a6f",
    "user_id": "b1f8b5f0-4d0b-4f2f-9f8b-2f6b8a6f6f10",
    "todo_id": "6a8f5f0e-4d0b-4f2f-9f8b-2f6b8a6f6f10",
    "reminder_id": "0f8b5f0e-4d0b-4f2f-9f8b-2f6b8a6f6f10",
    "title": "Upcoming Todo Due Date",
    "message": "Your Todo is approaching its due date: Finish backend project",
    "type": "due_date_reminder",
    "is_read": False,
    "read_at": None,
    "created_at": "2026-11-13T10:00:00Z",
}


@router.get(
    "/notifications",
    response_model=NotificationListResponse,
    summary="List the current user's notifications",
    description=(
        "Returns only notifications owned by the authenticated user. Results are "
        "ordered by created_at DESC, id DESC using signed keyset (cursor) "
        "pagination. OFFSET pagination is never used. Cursors are bound to the "
        "current user and to the is_read filter."
    ),
    responses={
        200: {
            "description": "A page of personal notifications",
            "content": {
                "application/json": {
                    "example": {
                        "items": [_NOTIFICATION_EXAMPLE],
                        "page": {
                            "limit": 20,
                            "next_cursor": "opaque-cursor",
                            "has_more": True,
                        },
                    }
                }
            },
        },
        400: {"description": "Invalid cursor, signature, version, user, or filter"},
        401: {"description": "Authentication required"},
    },
)
async def list_notifications(
    is_read: bool | None = Query(
        default=None,
        description="Filter by read state. Omit to return both read and unread.",
    ),
    limit: int = Query(
        default=20,
        ge=1,
        le=100,
        description="Page size. Defaults to 20 and may not exceed 100.",
    ),
    cursor: str | None = Query(
        default=None,
        description="Opaque signed cursor returned in page.next_cursor.",
    ),
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> NotificationListResponse:
    items, next_cursor, has_more = await NotificationController.list_notifications(
        session,
        user_id=current_user.id,
        is_read=is_read,
        limit=limit,
        cursor=cursor,
    )
    return NotificationListResponse(
        items=[NotificationResponse.model_validate(item) for item in items],
        page=NotificationListPage(limit=limit, next_cursor=next_cursor, has_more=has_more),
    )


@router.post(
    "/notifications/read-all",
    response_model=MarkAllReadResponse,
    summary="Mark all notifications for the current user as read",
    description=(
        "Marks every unread notification owned by the authenticated user as read "
        "using a single database update. The operation is idempotent and never "
        "changes another user's notifications."
    ),
    responses={
        200: {
            "description": "Number of notifications changed",
            "content": {"application/json": {"example": {"updated_count": 3}}},
        },
        401: {"description": "Authentication required"},
    },
)
async def mark_all_notifications_read(
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> MarkAllReadResponse:
    updated = await NotificationController.mark_all_read(session, user_id=current_user.id)
    return MarkAllReadResponse(updated_count=updated)


@router.get(
    "/notifications/{notification_id}",
    response_model=NotificationResponse,
    summary="Get a notification detail",
    description=(
        "Returns a notification only when it belongs to the authenticated user. "
        "Notifications owned by other users are reported as not found."
    ),
    responses={
        200: {"description": "Notification detail"},
        401: {"description": "Authentication required"},
        404: {"description": "Notification not found or not owned by the caller"},
    },
)
async def get_notification(
    notification_id: UUID = Path(..., description="Notification identifier"),
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> NotificationResponse:
    notification = await NotificationController.get_notification(
        session,
        notification_id=notification_id,
        user_id=current_user.id,
    )
    return NotificationResponse.model_validate(notification)


@router.post(
    "/notifications/{notification_id}/read",
    response_model=NotificationResponse,
    status_code=status.HTTP_200_OK,
    summary="Mark a notification as read",
    description=(
        "Marks one notification owned by the authenticated user as read. Repeated "
        "calls are idempotent and preserve the original read_at timestamp."
    ),
    responses={
        200: {"description": "Notification in read state"},
        401: {"description": "Authentication required"},
        404: {"description": "Notification not found or not owned by the caller"},
    },
)
async def mark_notification_read(
    notification_id: UUID = Path(..., description="Notification identifier"),
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> NotificationResponse:
    notification = await NotificationController.mark_read(
        session,
        notification_id=notification_id,
        user_id=current_user.id,
    )
    return NotificationResponse.model_validate(notification)
