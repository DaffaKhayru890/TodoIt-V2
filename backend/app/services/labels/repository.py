from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.labels.models import Label


class LabelRepository:
    @staticmethod
    async def create(session: AsyncSession, *, label: Label) -> Label:
        session.add(label)
        await session.flush()
        return label

    @staticmethod
    async def get_by_id(session: AsyncSession, label_id: UUID) -> Label | None:
        result = await session.execute(select(Label).where(Label.id == label_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def list_for_workspace(session: AsyncSession, workspace_id: UUID) -> list[Label]:
        result = await session.execute(
            select(Label).where(Label.workspace_id == workspace_id).order_by(Label.name.asc())
        )
        return list(result.scalars().all())

    @staticmethod
    async def delete(session: AsyncSession, label: Label) -> None:
        await session.delete(label)
        await session.flush()
