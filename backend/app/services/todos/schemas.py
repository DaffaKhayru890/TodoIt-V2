from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class TodoBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    status: str = "todo"
    priority: str = "medium"
    due_at: datetime | None = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str) -> str:
        allowed = {"todo", "in_progress", "completed"}
        if value not in allowed:
            raise ValueError("status must be one of: todo, in_progress, completed")
        return value

    @field_validator("priority")
    @classmethod
    def validate_priority(cls, value: str) -> str:
        allowed = {"low", "medium", "high", "urgent"}
        if value not in allowed:
            raise ValueError("priority must be one of: low, medium, high, urgent")
        return value

    model_config = ConfigDict(from_attributes=True)


class TodoCreateRequest(TodoBase):
    tag_ids: list[UUID] = Field(default_factory=list)
    label_ids: list[UUID] = Field(default_factory=list)


class TodoUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    status: str | None = None
    priority: str | None = None
    due_at: datetime | None = None
    tag_ids: list[UUID] | None = None
    label_ids: list[UUID] | None = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str | None) -> str | None:
        if value is None:
            return value
        allowed = {"todo", "in_progress", "completed"}
        if value not in allowed:
            raise ValueError("status must be one of: todo, in_progress, completed")
        return value

    @field_validator("priority")
    @classmethod
    def validate_priority(cls, value: str | None) -> str | None:
        if value is None:
            return value
        allowed = {"low", "medium", "high", "urgent"}
        if value not in allowed:
            raise ValueError("priority must be one of: low, medium, high, urgent")
        return value

    model_config = ConfigDict(from_attributes=True)


class TodoResponse(BaseModel):
    id: UUID
    workspace_id: UUID
    created_by: UUID
    title: str
    description: str | None = None
    status: str
    priority: str
    due_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    tag_ids: list[UUID] = Field(default_factory=list)
    label_ids: list[UUID] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class TodoListPage(BaseModel):
    limit: int
    next_cursor: str | None = None
    has_more: bool = False

    model_config = ConfigDict(from_attributes=True)


class TodoListResponse(BaseModel):
    items: list[TodoResponse]
    page: TodoListPage

    model_config = ConfigDict(from_attributes=True)
