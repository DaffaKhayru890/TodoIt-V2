from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.services.auth.dependencies import get_current_user
from app.services.notifications.controllers.notification_controller import NotificationController
from app.services.notifications.schemas import (
    NotificationListPage,
    NotificationListResponse,
    NotificationResponse,
)
from app.services.users.models import User

router = APIRouter(prefix="/api/v1", tags=["Notifications"])


@router.get(
    "/notifications",
    response_model=NotificationListResponse,
    summary="List notifications for the current user",
)
async def list_notifications(
    is_read: bool | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    cursor: str | None = Query(default=None),
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


@router.get(
    "/notifications/{notification_id}",
    response_model=NotificationResponse,
    summary="Get a notification detail",
)
async def get_notification(
    notification_id: UUID,
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
    summary="Mark a notification as read",
)
async def mark_notification_read(
    notification_id: UUID,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> NotificationResponse:
    notification = await NotificationController.mark_read(
        session,
        notification_id=notification_id,
        user_id=current_user.id,
    )
    return NotificationResponse.model_validate(notification)


@router.post(
    "/notifications/read-all",
    response_model=dict,
    summary="Mark all notifications for the current user as read",
)
async def mark_all_notifications_read(
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> dict:
    updated = await NotificationController.mark_all_read(session, user_id=current_user.id)
    return {"updated_count": updated}
