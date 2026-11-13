from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.services.auth.dependencies import get_current_user
from app.services.reminders.controllers.reminder_controller import ReminderController
from app.services.reminders.schemas import ReminderCreateRequest, ReminderResponse, ReminderUpdateRequest
from app.services.users.models import User

router = APIRouter(prefix="/api/v1", tags=["Reminders"])


@router.post(
    "/todos/{todo_id}/reminders",
    response_model=ReminderResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a reminder for a todo",
)
async def create_reminder(
    todo_id: UUID,
    payload: ReminderCreateRequest,
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
    response_model=list[ReminderResponse],
    summary="List reminders for a todo",
)
async def list_reminders(
    todo_id: UUID,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> list[ReminderResponse]:
    reminders = await ReminderController.list_todo_reminders(
        session,
        todo_id=todo_id,
        user_id=current_user.id,
    )
    return [ReminderResponse.model_validate(item) for item in reminders]


@router.patch(
    "/reminders/{reminder_id}",
    response_model=ReminderResponse,
    summary="Update a reminder",
)
async def update_reminder(
    reminder_id: UUID,
    payload: ReminderUpdateRequest,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> ReminderResponse:
    if payload.remind_at is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="INVALID_REMINDER_TIME")
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
)
async def cancel_reminder(
    reminder_id: UUID,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> None:
    await ReminderController.cancel_reminder(
        session,
        reminder_id=reminder_id,
        user_id=current_user.id,
    )
