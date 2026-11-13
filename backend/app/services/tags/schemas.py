from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class TagCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    model_config = ConfigDict(from_attributes=True)


class TagUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    model_config = ConfigDict(from_attributes=True)


class TagResponse(BaseModel):
    id: UUID
    workspace_id: UUID
    name: str
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)
