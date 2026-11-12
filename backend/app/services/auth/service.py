from __future__ import annotations

import hmac
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import jwt
from fastapi import HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.services.auth.repository import RefreshSessionRepository
from app.services.auth.security import (
    create_csrf_token,
    create_jwt_token,
    decode_and_validate_jwt,
    hash_token,
    verify_password,
    verify_token_hash,
)
from app.services.users.models import User
from app.services.users.repository import UserRepository


def _utc(value: datetime) -> datetime:
    if value.tzinfo is not None:
        return value.astimezone(UTC)
    return value.replace(tzinfo=UTC)


class AuthService:
    @staticmethod
    async def register(
        session: AsyncSession,
        *,
        email: str,
        password: str,
        full_name: str,
        timezone: str | None,
    ) -> User:
        from app.services.users.service import UserService

        try:
            user = await UserService.create_user(
                session,
                email=email,
                password=password,
                full_name=full_name,
                timezone=timezone,
            )
            await session.commit()
            return user
        except ValueError as exc:
            if str(exc) == "EMAIL_ALREADY_REGISTERED":
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="EMAIL_ALREADY_REGISTERED",
                ) from exc
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=str(exc),
            ) from exc

    @staticmethod
    async def login(
        session: AsyncSession,
        *,
        email: str,
        password: str,
    ) -> tuple[str, str, str, User]:
        normalized_email = email.strip().lower()
        user = await UserRepository.get_by_email(session, normalized_email)
        if user is None or not verify_password(password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )
        if not user.is_active:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User inactive")

        session_id = uuid4()
        jti = str(uuid4())
        refresh_jwt = create_jwt_token(
            str(user.id),
            session_id=str(session_id),
            token_type="refresh",
            jti=jti,
            expires_delta=timedelta(days=settings.jwt_refresh_token_expire_days),
        )
        refresh_hash = hash_token(refresh_jwt)
        expires_at = datetime.now(UTC) + timedelta(days=settings.jwt_refresh_token_expire_days)
        await RefreshSessionRepository.create(
            session,
            user_id=user.id,
            token_hash=refresh_hash,
            current_jti=jti,
            expires_at=expires_at,
            session_id=session_id,
        )

        access_token = create_jwt_token(
            str(user.id),
            session_id=str(session_id),
            token_type="access",
            jti=str(uuid4()),
            expires_delta=timedelta(minutes=settings.jwt_access_token_expire_minutes),
        )
        await session.commit()
        return access_token, refresh_jwt, create_csrf_token(), user

    @staticmethod
    async def refresh(
        session: AsyncSession,
        *,
        refresh_token: str,
        csrf_token: str | None,
        request: Request | None = None,
    ) -> tuple[str, str, User]:
        if not refresh_token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token",
            )
        try:
            payload = decode_and_validate_jwt(refresh_token)
        except jwt.PyJWTError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token",
            ) from exc

        if payload.get("token_type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token",
            )

        session_id = payload.get("sid")
        user_id = payload.get("sub")
        jti = payload.get("jti")
        if not session_id or not user_id or not jti:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token",
            )

        if request is not None:
            csrf_cookie = request.cookies.get(settings.csrf_cookie_name)
            if (
                not csrf_cookie
                or not csrf_token
                or not hmac.compare_digest(csrf_cookie, csrf_token)
            ):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="CSRF validation failed",
                )

        refresh_session = await RefreshSessionRepository.get_by_id_for_update(
            session,
            UUID(session_id),
        )
        if refresh_session is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="SESSION_NOT_FOUND",
            )
        if refresh_session.user_id != UUID(user_id):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="SESSION_NOT_FOUND",
            )
        if refresh_session.revoked_at is not None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="REFRESH_TOKEN_REVOKED",
            )
        if _utc(refresh_session.expires_at) < datetime.now(UTC):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="REFRESH_TOKEN_EXPIRED",
            )

        if refresh_session.current_jti != jti:
            await RefreshSessionRepository.revoke(session, refresh_session)
            await session.commit()
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="REFRESH_TOKEN_REPLAYED",
            )

        if not verify_token_hash(refresh_token, refresh_session.token_hash):
            await RefreshSessionRepository.revoke(session, refresh_session)
            await session.commit()
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="REFRESH_TOKEN_REPLAYED",
            )

        user = await UserRepository.get_by_id(session, refresh_session.user_id)
        if user is None or not user.is_active:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="USER_INACTIVE")

        new_session_id = refresh_session.id
        new_jti = str(uuid4())
        new_refresh_token = create_jwt_token(
            str(user.id),
            session_id=str(new_session_id),
            token_type="refresh",
            jti=new_jti,
            expires_delta=timedelta(days=settings.jwt_refresh_token_expire_days),
        )
        await RefreshSessionRepository.update_token(
            session,
            refresh_session,
            token_hash=hash_token(new_refresh_token),
            current_jti=new_jti,
            expires_at=datetime.now(UTC)
            + timedelta(days=settings.jwt_refresh_token_expire_days),
        )

        new_access_token = create_jwt_token(
            str(user.id),
            session_id=str(new_session_id),
            token_type="access",
            jti=str(uuid4()),
            expires_delta=timedelta(minutes=settings.jwt_access_token_expire_minutes),
        )
        await session.commit()
        return new_access_token, new_refresh_token, user

    @staticmethod
    async def logout(session: AsyncSession, *, refresh_token: str | None) -> None:
        if not refresh_token:
            return
        try:
            payload = decode_and_validate_jwt(refresh_token)
        except jwt.PyJWTError:
            return
        if payload.get("token_type") != "refresh":
            return
        session_id = payload.get("sid")
        if not session_id:
            return
        refresh_session = await RefreshSessionRepository.get_by_id_for_update(
            session,
            UUID(session_id),
        )
        if refresh_session is not None:
            await RefreshSessionRepository.revoke(session, refresh_session)
            await session.commit()

    @staticmethod
    async def logout_all(session: AsyncSession, *, user_id: UUID) -> None:
        await RefreshSessionRepository.revoke_all_for_user(session, user_id)
        await session.commit()

    @staticmethod
    async def get_current_user(session: AsyncSession, *, user_id: UUID) -> User | None:
        return await UserRepository.get_by_id(session, user_id)
