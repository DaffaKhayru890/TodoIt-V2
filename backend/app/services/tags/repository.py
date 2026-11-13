from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.tags.models import Tag


class TagRepository:
    @staticmethod
    async def create(session: AsyncSession, *, tag: Tag) -> Tag:
        session.add(tag)
        await session.flush()
        return tag

    @staticmethod
    async def get_by_id(session: AsyncSession, tag_id: UUID) -> Tag | None:
        result = await session.execute(select(Tag).where(Tag.id == tag_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def list_for_workspace(session: AsyncSession, workspace_id: UUID) -> list[Tag]:
        result = await session.execute(
            select(Tag).where(Tag.workspace_id == workspace_id).order_by(Tag.name.asc())
        )
        return list(result.scalars().all())

    @staticmethod
    async def delete(session: AsyncSession, tag: Tag) -> None:
        await session.delete(tag)
        await session.flush()
