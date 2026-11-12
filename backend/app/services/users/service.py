from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID, uuid4

from email_validator import EmailNotValidError, validate_email
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.services.auth.security import hash_password
from app.services.users.models import User


def normalize_email(email: str) -> str:
    cleaned = email.strip().lower()
    try:
        return validate_email(cleaned, check_deliverability=False).normalized
    except EmailNotValidError as exc:
        raise ValueError("Invalid email") from exc


def validate_timezone(timezone_name: str | None) -> str:
    chosen = timezone_name or settings.default_timezone
    try:
        import zoneinfo

        zoneinfo.ZoneInfo(chosen)
    except Exception as exc:  # pragma: no cover - defensive branch
        raise ValueError("Invalid timezone") from exc
    return chosen


class UserService:
    @staticmethod
    async def create_user(
        session: AsyncSession,
        *,
        email: str,
        password: str,
        full_name: str,
        timezone: str | None = None,
    ) -> User:
        normalized_email = normalize_email(email)
        if not full_name or not full_name.strip():
            raise ValueError("Full name is required")
        if len(password) < 12 or len(password) > 128:
            raise ValueError("Password length must be between 12 and 128 characters")
        valid_timezone = validate_timezone(timezone)

        user = User(
            id=uuid4(),
            email=normalized_email,
            password_hash=hash_password(password),
            full_name=full_name.strip(),
            timezone=valid_timezone,
            is_active=True,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )

        session.add(user)
        try:
            await session.flush()
        except IntegrityError as exc:
            raise ValueError("EMAIL_ALREADY_REGISTERED") from exc
        return user

    @staticmethod
    async def get_by_email(session: AsyncSession, email: str) -> User | None:
        normalized_email = normalize_email(email)
        result = await session.execute(select(User).where(User.email == normalized_email))
        return result.scalar_one_or_none()

    @staticmethod
    async def get_by_id(session: AsyncSession, user_id: UUID) -> User | None:
        result = await session.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def get_profile(session: AsyncSession, user_id: UUID) -> User | None:
        return await UserService.get_by_id(session, user_id)
