from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.todos.models import Todo


class TodoRepository:
    @staticmethod
    async def create(session: AsyncSession, *, todo: Todo) -> Todo:
        session.add(todo)
        await session.flush()
        return todo

    @staticmethod
    async def get_by_id(session: AsyncSession, todo_id: UUID) -> Todo | None:
        result = await session.execute(select(Todo).where(Todo.id == todo_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def list_for_workspace(
        session: AsyncSession,
        workspace_id: UUID,
        *,
        limit: int | None = None,
        before_created_at: datetime | None = None,
        before_id: UUID | None = None,
    ) -> list[Todo]:
        stmt = (
            select(Todo)
            .where(Todo.workspace_id == workspace_id)
            .order_by(Todo.created_at.desc(), Todo.id.desc())
        )
        if before_created_at is not None and before_id is not None:
            stmt = stmt.where(
                (Todo.created_at < before_created_at)
                | ((Todo.created_at == before_created_at) & (Todo.id < before_id))
            )
        if limit is not None:
            stmt = stmt.limit(limit)
        result = await session.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def delete(session: AsyncSession, todo: Todo) -> None:
        await session.delete(todo)
        await session.flush()
