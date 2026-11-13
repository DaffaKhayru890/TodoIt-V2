from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ReminderCreateRequest(BaseModel):
    remind_at: datetime = Field(
        ...,
        description="Timezone-aware instant at which the reminder should be delivered.",
        examples=["2026-11-15T10:00:00Z"],
    )
    model_config = ConfigDict(extra="forbid")


class ReminderUpdateRequest(BaseModel):
    remind_at: datetime = Field(
        ...,
        description="New timezone-aware reminder instant. Must be in the future.",
        examples=["2026-11-15T12:00:00Z"],
    )
    model_config = ConfigDict(extra="forbid")


class ReminderResponse(BaseModel):
    id: UUID
    todo_id: UUID
    user_id: UUID
    source: str
    remind_at: datetime
    status: str
    processed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ReminderListResponse(BaseModel):
    items: list[ReminderResponse]
    model_config = ConfigDict(from_attributes=True)
