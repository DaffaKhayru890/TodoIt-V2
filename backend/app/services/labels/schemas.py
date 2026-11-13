from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class LabelCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    color: str = Field(default="#6B7280", min_length=7, max_length=16)
    model_config = ConfigDict(from_attributes=True)


class LabelUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    color: str | None = Field(default=None, min_length=7, max_length=16)
    model_config = ConfigDict(from_attributes=True)


class LabelResponse(BaseModel):
    id: UUID
    workspace_id: UUID
    name: str
    color: str
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)
