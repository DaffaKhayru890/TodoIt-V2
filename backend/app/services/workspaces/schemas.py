from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class WorkspaceCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=2000)


class WorkspaceUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=2000)


class WorkspaceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: str | None = None
    owner_id: UUID
    is_archived: bool
    created_at: datetime
    updated_at: datetime


class WorkspaceMemberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    workspace_id: UUID
    user_id: UUID
    role: str
    joined_at: datetime
    created_at: datetime
    updated_at: datetime
    user_email: EmailStr | str | None = None
    full_name: str | None = None


class WorkspaceMemberUpdateRequest(BaseModel):
    role: str = Field(..., min_length=1, max_length=32)


class WorkspaceInvitationCreateRequest(BaseModel):
    email: EmailStr
    role: str = Field(default="member", min_length=1, max_length=32)


class WorkspaceInvitationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    workspace_id: UUID
    inviter_id: UUID
    email: EmailStr | str
    role: str
    status: str
    expires_at: datetime
    accepted_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    token: str | None = None


class InvitationAcceptRequest(BaseModel):
    token: str = Field(..., min_length=1)


class InvitationAcceptResponse(BaseModel):
    workspace_id: UUID
    workspace_name: str
    role: str
    member: WorkspaceMemberResponse
