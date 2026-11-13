from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Path, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.services.auth.dependencies import get_current_user
from app.services.reminders.controllers.reminder_controller import ReminderController
from app.services.reminders.schemas import (
    ReminderCreateRequest,
    ReminderListResponse,
    ReminderResponse,
    ReminderUpdateRequest,
)
from app.services.users.models import User

router = APIRouter(prefix="/api/v1", tags=["Reminders"])

_REMINDER_EXAMPLE = {
    "id": "0f8b5f0e-4d0b-4f2f-9f8b-2f6b8a6f6f10",
    "todo_id": "6a8f5f0e-4d0b-4f2f-9f8b-2f6b8a6f6f10",
    "user_id": "b1f8b5f0-4d0b-4f2f-9f8b-2f6b8a6f6f10",
    "source": "manual",
    "remind_at": "2026-11-15T10:00:00Z",
    "status": "pending",
    "processed_at": None,
    "created_at": "2026-11-13T10:00:00Z",
    "updated_at": "2026-11-13T10:00:00Z",
}


@router.post(
    "/todos/{todo_id}/reminders",
    response_model=ReminderResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a personal reminder for a todo",
    description=(
        "Creates a manual reminder owned by the authenticated user. The recipient "
        "is always taken from the access token and cannot be supplied in the body. "
        "The Todo must be accessible through an active workspace membership."
    ),
    responses={
        201: {
            "description": "Reminder created",
            "content": {"application/json": {"example": _REMINDER_EXAMPLE}},
        },
        401: {"description": "Authentication required"},
        403: {"description": "Workspace access denied"},
        404: {"description": "Todo not found"},
        409: {"description": "Duplicate pending reminder at the same time"},
        422: {"description": "Invalid or past reminder time"},
    },
)
async def create_reminder(
    payload: ReminderCreateRequest,
    todo_id: UUID = Path(..., description="Todo identifier"),
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> ReminderResponse:
    reminder = await ReminderController.create_manual_reminder(
        session,
        todo_id=todo_id,
        user_id=current_user.id,
        remind_at=payload.remind_at,
    )
    return ReminderResponse.model_validate(reminder)


@router.get(
    "/todos/{todo_id}/reminders",
    response_model=ReminderListResponse,
    summary="List the current user's reminders for a todo",
    description=(
        "Returns only reminders owned by the authenticated user. Reminders created "
        "by other workspace members are personal and are never exposed here."
    ),
    responses={
        200: {
            "description": "Personal reminders for the Todo",
            "content": {"application/json": {"example": {"items": [_REMINDER_EXAMPLE]}}},
        },
        401: {"description": "Authentication required"},
        403: {"description": "Workspace access denied"},
        404: {"description": "Todo not found"},
    },
)
async def list_reminders(
    todo_id: UUID = Path(..., description="Todo identifier"),
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> ReminderListResponse:
    reminders = await ReminderController.list_todo_reminders(
        session,
        todo_id=todo_id,
        user_id=current_user.id,
    )
    return ReminderListResponse(items=[ReminderResponse.model_validate(item) for item in reminders])


@router.patch(
    "/reminders/{reminder_id}",
    response_model=ReminderResponse,
    summary="Reschedule a pending manual reminder",
    description=(
        "Only the owner may update a reminder. Automatic, processed, and cancelled "
        "reminders cannot be changed through this endpoint."
    ),
    responses={
        200: {"description": "Reminder updated"},
        401: {"description": "Authentication required"},
        403: {"description": "Reminder belongs to another user"},
        404: {"description": "Reminder not found"},
        409: {"description": "Reminder is not pending or is automatic"},
        422: {"description": "Invalid or past reminder time"},
    },
)
async def update_reminder(
    payload: ReminderUpdateRequest,
    reminder_id: UUID = Path(..., description="Reminder identifier"),
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> ReminderResponse:
    reminder = await ReminderController.update_reminder(
        session,
        reminder_id=reminder_id,
        user_id=current_user.id,
        remind_at=payload.remind_at,
    )
    return ReminderResponse.model_validate(reminder)


@router.delete(
    "/reminders/{reminder_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Cancel a reminder",
    description=(
        "Soft-cancels a reminder by setting its status to cancelled. Cancelling an "
        "already cancelled reminder is idempotent. Processed reminders cannot be "
        "cancelled and notification history is never deleted."
    ),
    responses={
        204: {"description": "Reminder cancelled or already cancelled"},
        401: {"description": "Authentication required"},
        403: {"description": "Reminder belongs to another user"},
        404: {"description": "Reminder not found"},
        409: {"description": "Reminder was already processed"},
    },
)
async def cancel_reminder(
    reminder_id: UUID = Path(..., description="Reminder identifier"),
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> None:
    await ReminderController.cancel_reminder(
        session,
        reminder_id=reminder_id,
        user_id=current_user.id,
    )
