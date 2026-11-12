from __future__ import annotations

from datetime import datetime
from uuid import UUID

from email_validator import EmailNotValidError, validate_email
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.core.config import settings


class UserBase(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=1, max_length=100)
    timezone: str = Field(default=settings.default_timezone)

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, value: str) -> str:
        try:
            import zoneinfo

            zoneinfo.ZoneInfo(value)
        except Exception as exc:  # pragma: no cover - defensive branch
            raise ValueError("Invalid timezone") from exc
        return value

    @field_validator("email")
    @classmethod
    def validate_email_format(cls, value: str) -> str:
        try:
            validated = validate_email(value, check_deliverability=False)
        except EmailNotValidError as exc:
            raise ValueError("Invalid email") from exc
        return validated.normalized


class UserRegisterRequest(UserBase):
    password: str = Field(..., min_length=12, max_length=128)


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: EmailStr
    full_name: str
    timezone: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


class UserProfileResponse(UserResponse):
    pass
