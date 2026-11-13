from __future__ import annotations

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.workspaces.service import WorkspaceService


class WorkspaceController:
    @staticmethod
    async def create_workspace(
        session: AsyncSession, *, user_id: UUID, name: str, description: str | None = None
    ):
        return await WorkspaceService.create_workspace(
            session,
            user_id=user_id,
            name=name,
            description=description,
        )

    @staticmethod
    async def list_workspaces(session: AsyncSession, *, user_id: UUID):
        return await WorkspaceService.list_workspaces(session, user_id=user_id)

    @staticmethod
    async def get_workspace(session: AsyncSession, *, workspace_id: UUID, user_id: UUID):
        return await WorkspaceService.get_workspace_for_user(
            session,
            workspace_id=workspace_id,
            user_id=user_id,
        )
