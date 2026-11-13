from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class NotificationResponse(BaseModel):
    id: UUID
    user_id: UUID
    todo_id: UUID | None = None
    reminder_id: UUID | None = None
    title: str
    message: str
    type: str
    is_read: bool
    read_at: datetime | None = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class NotificationListPage(BaseModel):
    limit: int
    next_cursor: str | None = None
    has_more: bool


class NotificationListResponse(BaseModel):
    items: list[NotificationResponse]
    page: NotificationListPage


class MarkAllReadResponse(BaseModel):
    updated_count: int
