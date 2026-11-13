from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.workspaces.models import Workspace, WorkspaceInvitation, WorkspaceMember


class WorkspaceRepository:
    @staticmethod
    async def create(session: AsyncSession, *, workspace: Workspace) -> Workspace:
        session.add(workspace)
        await session.flush()
        return workspace

    @staticmethod
    async def get_by_id(session: AsyncSession, workspace_id: UUID) -> Workspace | None:
        result = await session.execute(select(Workspace).where(Workspace.id == workspace_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def list_for_user(session: AsyncSession, user_id: UUID) -> list[Workspace]:
        result = await session.execute(
            select(Workspace)
            .join(WorkspaceMember, Workspace.id == WorkspaceMember.workspace_id)
            .where(WorkspaceMember.user_id == user_id)
            .where(Workspace.is_archived.is_(False))
            .order_by(Workspace.updated_at.desc(), Workspace.created_at.desc())
        )
        return list(result.scalars().all())


class WorkspaceMemberRepository:
    @staticmethod
    async def get(
        session: AsyncSession, *, workspace_id: UUID, user_id: UUID
    ) -> WorkspaceMember | None:
        result = await session.execute(
            select(WorkspaceMember).where(
                WorkspaceMember.workspace_id == workspace_id,
                WorkspaceMember.user_id == user_id,
            )
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def list_for_workspace(
        session: AsyncSession, workspace_id: UUID
    ) -> list[WorkspaceMember]:
        result = await session.execute(
            select(WorkspaceMember)
            .where(WorkspaceMember.workspace_id == workspace_id)
            .order_by(WorkspaceMember.role.asc(), WorkspaceMember.joined_at.asc())
        )
        return list(result.scalars().all())

    @staticmethod
    async def create(
        session: AsyncSession, *, workspace_member: WorkspaceMember
    ) -> WorkspaceMember:
        session.add(workspace_member)
        await session.flush()
        return workspace_member

    @staticmethod
    async def update_role(
        session: AsyncSession,
        workspace_member: WorkspaceMember,
        *,
        role: str,
    ) -> WorkspaceMember:
        workspace_member.role = role
        workspace_member.updated_at = datetime.now(UTC)
        await session.flush()
        return workspace_member

    @staticmethod
    async def delete(session: AsyncSession, workspace_member: WorkspaceMember) -> None:
        await session.delete(workspace_member)
        await session.flush()


class WorkspaceInvitationRepository:
    @staticmethod
    async def create(
        session: AsyncSession,
        *,
        invitation: WorkspaceInvitation,
    ) -> WorkspaceInvitation:
        session.add(invitation)
        await session.flush()
        return invitation

    @staticmethod
    async def get_by_id(session: AsyncSession, invitation_id: UUID) -> WorkspaceInvitation | None:
        result = await session.execute(
            select(WorkspaceInvitation).where(WorkspaceInvitation.id == invitation_id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def get_by_token_hash(
        session: AsyncSession, token_hash: str
    ) -> WorkspaceInvitation | None:
        result = await session.execute(
            select(WorkspaceInvitation).where(WorkspaceInvitation.token_hash == token_hash)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def list_for_workspace(
        session: AsyncSession, workspace_id: UUID
    ) -> list[WorkspaceInvitation]:
        result = await session.execute(
            select(WorkspaceInvitation)
            .where(WorkspaceInvitation.workspace_id == workspace_id)
            .order_by(WorkspaceInvitation.created_at.desc())
        )
        return list(result.scalars().all())

    @staticmethod
    async def revoke(session: AsyncSession, invitation: WorkspaceInvitation) -> WorkspaceInvitation:
        invitation.status = "revoked"
        invitation.updated_at = datetime.now(UTC)
        await session.flush()
        return invitation

    @staticmethod
    async def mark_expired(
        session: AsyncSession, invitation: WorkspaceInvitation
    ) -> WorkspaceInvitation:
        invitation.status = "expired"
        invitation.updated_at = datetime.now(UTC)
        await session.flush()
        return invitation
