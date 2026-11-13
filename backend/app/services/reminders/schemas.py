from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ReminderCreateRequest(BaseModel):
    remind_at: datetime
    model_config = ConfigDict(extra="forbid")


class ReminderUpdateRequest(BaseModel):
    remind_at: datetime | None = None
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
