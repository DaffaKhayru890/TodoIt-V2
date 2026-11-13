from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.labels.models import Label
from app.services.labels.repository import LabelRepository
from app.services.workspaces.service import WorkspaceService


class LabelService:
    @staticmethod
    async def create_label(
        session: AsyncSession,
        *,
        workspace_id: UUID,
        user_id: UUID,
        name: str,
        color: str,
    ) -> Label:
        await WorkspaceService.require_access(session, workspace_id, user_id)
        cleaned = (name or "").strip()
        if not cleaned:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="INVALID_LABEL_NAME"
            )
        if color and not color.startswith("#") or len(color) != 7:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="INVALID_LABEL_COLOR"
            )
        existing = await session.execute(
            select(Label).where(Label.workspace_id == workspace_id, Label.name == cleaned)
        )
        if existing.scalar_one_or_none() is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="LABEL_ALREADY_EXISTS")
        label = Label(workspace_id=workspace_id, name=cleaned, color=color)
        await LabelRepository.create(session, label=label)
        await session.commit()
        return label

    @staticmethod
    async def list_labels(
        session: AsyncSession, *, workspace_id: UUID, user_id: UUID
    ) -> list[Label]:
        await WorkspaceService.require_access(session, workspace_id, user_id)
        return await LabelRepository.list_for_workspace(session, workspace_id)

    @staticmethod
    async def get_label(
        session: AsyncSession, *, workspace_id: UUID, user_id: UUID, label_id: UUID
    ) -> Label:
        await WorkspaceService.require_access(session, workspace_id, user_id)
        label = await LabelRepository.get_by_id(session, label_id)
        if label is None or label.workspace_id != workspace_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="LABEL_NOT_FOUND")
        return label

    @staticmethod
    async def update_label(
        session: AsyncSession,
        *,
        workspace_id: UUID,
        user_id: UUID,
        label_id: UUID,
        name: str | None,
        color: str | None,
    ) -> Label:
        await WorkspaceService.require_permission(
            session, workspace_id, user_id, {"owner", "admin"}
        )
        label = await LabelRepository.get_by_id(session, label_id)
        if label is None or label.workspace_id != workspace_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="LABEL_NOT_FOUND")
        if name is not None:
            cleaned = name.strip()
            if not cleaned:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="INVALID_LABEL_NAME"
                )
            existing = await session.execute(
                select(Label).where(
                    Label.workspace_id == workspace_id, Label.name == cleaned, Label.id != label_id
                )
            )
            if existing.scalar_one_or_none() is not None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT, detail="LABEL_ALREADY_EXISTS"
                )
            label.name = cleaned
        if color is not None:
            if not color.startswith("#") or len(color) != 7:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="INVALID_LABEL_COLOR"
                )
            label.color = color
        label.updated_at = __import__("datetime").datetime.now(__import__("datetime").UTC)
        await session.commit()
        return label

    @staticmethod
    async def delete_label(
        session: AsyncSession,
        *,
        workspace_id: UUID,
        user_id: UUID,
        label_id: UUID,
    ) -> None:
        await WorkspaceService.require_permission(
            session, workspace_id, user_id, {"owner", "admin"}
        )
        label = await LabelRepository.get_by_id(session, label_id)
        if label is None or label.workspace_id != workspace_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="LABEL_NOT_FOUND")
        await LabelRepository.delete(session, label)
        await session.commit()
