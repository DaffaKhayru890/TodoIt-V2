from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.tags.models import Tag
from app.services.tags.repository import TagRepository
from app.services.workspaces.service import WorkspaceService


class TagService:
    @staticmethod
    async def create_tag(
        session: AsyncSession,
        *,
        workspace_id: UUID,
        user_id: UUID,
        name: str,
    ) -> Tag:
        await WorkspaceService.require_access(session, workspace_id, user_id)
        cleaned = (name or "").strip()
        if not cleaned:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="INVALID_TAG_NAME"
            )
        existing = await session.execute(
            select(Tag).where(Tag.workspace_id == workspace_id, Tag.name == cleaned)
        )
        if existing.scalar_one_or_none() is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="TAG_ALREADY_EXISTS")
        tag = Tag(workspace_id=workspace_id, name=cleaned)
        await TagRepository.create(session, tag=tag)
        await session.commit()
        return tag

    @staticmethod
    async def list_tags(session: AsyncSession, *, workspace_id: UUID, user_id: UUID) -> list[Tag]:
        await WorkspaceService.require_access(session, workspace_id, user_id)
        return await TagRepository.list_for_workspace(session, workspace_id)

    @staticmethod
    async def get_tag(
        session: AsyncSession, *, workspace_id: UUID, user_id: UUID, tag_id: UUID
    ) -> Tag:
        await WorkspaceService.require_access(session, workspace_id, user_id)
        tag = await TagRepository.get_by_id(session, tag_id)
        if tag is None or tag.workspace_id != workspace_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="TAG_NOT_FOUND")
        return tag

    @staticmethod
    async def update_tag(
        session: AsyncSession,
        *,
        workspace_id: UUID,
        user_id: UUID,
        tag_id: UUID,
        name: str | None,
    ) -> Tag:
        await WorkspaceService.require_permission(
            session, workspace_id, user_id, {"owner", "admin"}
        )
        tag = await TagRepository.get_by_id(session, tag_id)
        if tag is None or tag.workspace_id != workspace_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="TAG_NOT_FOUND")
        if name is not None:
            cleaned = name.strip()
            if not cleaned:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="INVALID_TAG_NAME"
                )
            existing = await session.execute(
                select(Tag).where(
                    Tag.workspace_id == workspace_id, Tag.name == cleaned, Tag.id != tag_id
                )
            )
            if existing.scalar_one_or_none() is not None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT, detail="TAG_ALREADY_EXISTS"
                )
            tag.name = cleaned
        tag.updated_at = __import__("datetime").datetime.now(__import__("datetime").UTC)
        await session.commit()
        return tag

    @staticmethod
    async def delete_tag(
        session: AsyncSession,
        *,
        workspace_id: UUID,
        user_id: UUID,
        tag_id: UUID,
    ) -> None:
        await WorkspaceService.require_permission(
            session, workspace_id, user_id, {"owner", "admin"}
        )
        tag = await TagRepository.get_by_id(session, tag_id)
        if tag is None or tag.workspace_id != workspace_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="TAG_NOT_FOUND")
        await TagRepository.delete(session, tag)
        await session.commit()
