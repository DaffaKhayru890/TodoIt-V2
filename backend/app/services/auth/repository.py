from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.auth.models import RefreshSession


class RefreshSessionRepository:
    @staticmethod
    async def create(
        session: AsyncSession,
        *,
        user_id: UUID,
        token_hash: str,
        current_jti: str,
        expires_at: datetime,
        session_id: UUID | None = None,
    ) -> RefreshSession:
        refresh_session = RefreshSession(
            id=session_id or __import__("uuid").uuid4(),
            user_id=user_id,
            token_hash=token_hash,
            current_jti=current_jti,
            expires_at=expires_at,
            last_used_at=None,
            revoked_at=None,
        )
        session.add(refresh_session)
        await session.flush()
        return refresh_session

    @staticmethod
    async def get_by_id(session: AsyncSession, session_id: UUID) -> RefreshSession | None:
        result = await session.execute(
            select(RefreshSession).where(RefreshSession.id == session_id),
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def get_by_id_for_update(
        session: AsyncSession,
        session_id: UUID,
    ) -> RefreshSession | None:
        result = await session.execute(
            select(RefreshSession).where(RefreshSession.id == session_id).with_for_update(),
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def get_for_user(session: AsyncSession, user_id: UUID) -> list[RefreshSession]:
        result = await session.execute(
            select(RefreshSession)
            .where(RefreshSession.user_id == user_id)
            .order_by(RefreshSession.created_at.desc())
        )
        return list(result.scalars().all())

    @staticmethod
    async def revoke(session: AsyncSession, refresh_session: RefreshSession) -> None:
        refresh_session.revoked_at = datetime.now().astimezone()
        refresh_session.updated_at = datetime.now().astimezone()
        await session.flush()

    @staticmethod
    async def revoke_all_for_user(session: AsyncSession, user_id: UUID) -> list[RefreshSession]:
        sessions = await RefreshSessionRepository.get_for_user(session, user_id)
        for refresh_session in sessions:
            if refresh_session.revoked_at is None:
                refresh_session.revoked_at = datetime.now().astimezone()
                refresh_session.updated_at = datetime.now().astimezone()
        await session.flush()
        return sessions

    @staticmethod
    async def update_token(
        session: AsyncSession,
        refresh_session: RefreshSession,
        *,
        token_hash: str,
        current_jti: str,
        expires_at: datetime,
    ) -> RefreshSession:
        refresh_session.token_hash = token_hash
        refresh_session.current_jti = current_jti
        refresh_session.expires_at = expires_at
        refresh_session.last_used_at = datetime.now().astimezone()
        refresh_session.updated_at = datetime.now().astimezone()
        await session.flush()
        return refresh_session
