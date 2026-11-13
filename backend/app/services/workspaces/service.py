from __future__ import annotations

import secrets
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.auth.security import hash_token
from app.services.users.models import User
from app.services.workspaces.models import Workspace, WorkspaceInvitation, WorkspaceMember
from app.services.workspaces.repository import (
    WorkspaceInvitationRepository,
    WorkspaceMemberRepository,
    WorkspaceRepository,
)

_VALID_ROLES = {"owner", "admin", "member"}


def _utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


async def require_workspace_access(
    session: AsyncSession,
    workspace_id: UUID,
    user_id: UUID,
) -> Workspace:
    return await WorkspaceService.require_access(session, workspace_id, user_id)


async def require_workspace_permission(
    session: AsyncSession,
    workspace_id: UUID,
    user_id: UUID,
    allowed_roles: set[str],
) -> WorkspaceMember:
    return await WorkspaceService.require_permission(session, workspace_id, user_id, allowed_roles)


async def require_member_or_owner(
    session: AsyncSession,
    workspace_id: UUID,
    user_id: UUID,
) -> WorkspaceMember:
    return await WorkspaceService.require_permission(
        session, workspace_id, user_id, {"owner", "admin", "member"}
    )


class WorkspaceService:
    @staticmethod
    async def get_by_id(session: AsyncSession, workspace_id: UUID) -> Workspace | None:
        return await WorkspaceRepository.get_by_id(session, workspace_id)

    @staticmethod
    async def create_workspace(
        session: AsyncSession,
        *,
        user_id: UUID,
        name: str,
        description: str | None = None,
    ) -> Workspace:
        cleaned_name = (name or "").strip()
        if not cleaned_name:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Workspace name is required",
            )
        cleaned_description = description.strip() if description and description.strip() else None

        workspace = Workspace(
            id=uuid4(),
            name=cleaned_name,
            description=cleaned_description,
            owner_id=user_id,
        )
        await WorkspaceRepository.create(session, workspace=workspace)

        member = WorkspaceMember(
            id=uuid4(),
            workspace_id=workspace.id,
            user_id=user_id,
            role="owner",
        )
        await WorkspaceMemberRepository.create(session, workspace_member=member)
        await session.commit()
        return workspace

    @staticmethod
    async def list_workspaces(session: AsyncSession, *, user_id: UUID) -> list[Workspace]:
        return await WorkspaceRepository.list_for_user(session, user_id)

    @staticmethod
    async def get_workspace_for_user(
        session: AsyncSession,
        *,
        workspace_id: UUID,
        user_id: UUID,
    ) -> Workspace:
        return await WorkspaceService.require_access(session, workspace_id, user_id)

    @staticmethod
    async def require_access(
        session: AsyncSession,
        workspace_id: UUID,
        user_id: UUID,
    ) -> Workspace:
        workspace = await WorkspaceRepository.get_by_id(session, workspace_id)
        if workspace is None or workspace.is_archived:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="WORKSPACE_NOT_FOUND")

        membership = await WorkspaceMemberRepository.get(
            session,
            workspace_id=workspace_id,
            user_id=user_id,
        )
        if membership is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="WORKSPACE_ACCESS_DENIED"
            )
        return workspace

    @staticmethod
    async def require_permission(
        session: AsyncSession,
        workspace_id: UUID,
        user_id: UUID,
        allowed_roles: set[str],
    ) -> WorkspaceMember:
        workspace = await WorkspaceService.require_access(session, workspace_id, user_id)
        _ = workspace
        membership = await WorkspaceMemberRepository.get(
            session, workspace_id=workspace_id, user_id=user_id
        )
        if membership is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="WORKSPACE_ACCESS_DENIED"
            )
        if membership.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="INSUFFICIENT_PERMISSION"
            )
        return membership

    @staticmethod
    async def update_workspace(
        session: AsyncSession,
        *,
        workspace_id: UUID,
        actor_id: UUID,
        name: str | None,
        description: str | None,
    ) -> Workspace:
        await WorkspaceService.require_permission(
            session, workspace_id, actor_id, {"owner", "admin"}
        )
        workspace = await WorkspaceRepository.get_by_id(session, workspace_id)
        if workspace is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="WORKSPACE_NOT_FOUND")

        if name is not None:
            cleaned_name = name.strip()
            if not cleaned_name:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Workspace name is required",
                )
            workspace.name = cleaned_name
        if description is not None:
            workspace.description = description.strip() if description.strip() else None
        workspace.updated_at = datetime.now(UTC)
        await session.commit()
        return workspace

    @staticmethod
    async def archive_workspace(
        session: AsyncSession, *, workspace_id: UUID, actor_id: UUID
    ) -> None:
        await WorkspaceService.require_permission(session, workspace_id, actor_id, {"owner"})
        workspace = await WorkspaceRepository.get_by_id(session, workspace_id)
        if workspace is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="WORKSPACE_NOT_FOUND")
        workspace.is_archived = True
        workspace.updated_at = datetime.now(UTC)
        await session.commit()

    @staticmethod
    async def list_members(
        session: AsyncSession, *, workspace_id: UUID, actor_id: UUID
    ) -> list[WorkspaceMember]:
        await WorkspaceService.require_access(session, workspace_id, actor_id)
        return await WorkspaceMemberRepository.list_for_workspace(session, workspace_id)

    @staticmethod
    async def update_member_role(
        session: AsyncSession,
        *,
        workspace_id: UUID,
        actor_id: UUID,
        target_user_id: UUID,
        new_role: str,
    ) -> WorkspaceMember:
        actor_member = await WorkspaceService.require_permission(
            session,
            workspace_id,
            actor_id,
            {"owner", "admin"},
        )
        target_member = await WorkspaceMemberRepository.get(
            session,
            workspace_id=workspace_id,
            user_id=target_user_id,
        )
        if target_member is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="MEMBER_NOT_FOUND")
        if target_member.role == "owner":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="OWNER_ROLE_IS_PROTECTED"
            )
        normalized_role = (new_role or "").strip().lower()
        if normalized_role not in {"admin", "member"}:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="INVALID_ROLE"
            )
        if actor_member.role == "admin" and normalized_role == "owner":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="INSUFFICIENT_PERMISSION"
            )
        if actor_member.role == "admin" and target_member.user_id != actor_id:
            # Admins may manage other members but cannot escalate role to owner.
            pass
        target_member.role = normalized_role
        target_member.updated_at = datetime.now(UTC)
        await session.commit()
        return target_member

    @staticmethod
    async def remove_member(
        session: AsyncSession,
        *,
        workspace_id: UUID,
        actor_id: UUID,
        target_user_id: UUID,
    ) -> None:
        actor_member = await WorkspaceService.require_permission(
            session,
            workspace_id,
            actor_id,
            {"owner", "admin"},
        )
        target_member = await WorkspaceMemberRepository.get(
            session,
            workspace_id=workspace_id,
            user_id=target_user_id,
        )
        if target_member is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="MEMBER_NOT_FOUND")
        if target_member.role == "owner":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="OWNER_CANNOT_BE_REMOVED"
            )
        if actor_member.role == "admin" and target_user_id == actor_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="INSUFFICIENT_PERMISSION"
            )
        await WorkspaceMemberRepository.delete(session, target_member)
        await session.commit()

    @staticmethod
    async def create_invitation(
        session: AsyncSession,
        *,
        workspace_id: UUID,
        actor_id: UUID,
        email: str,
        role: str,
    ) -> tuple[WorkspaceInvitation, str]:
        await WorkspaceService.require_permission(
            session, workspace_id, actor_id, {"owner", "admin"}
        )
        normalized_email = (email or "").strip().lower()
        if not normalized_email:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Email is required"
            )

        result = await session.execute(select(User).where(User.email == normalized_email))
        invited_user = result.scalar_one_or_none()
        if invited_user is not None:
            existing_membership = await WorkspaceMemberRepository.get(
                session,
                workspace_id=workspace_id,
                user_id=invited_user.id,
            )
            if existing_membership is not None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT, detail="USER_ALREADY_MEMBER"
                )

        normalized_role = (role or "").strip().lower()
        if normalized_role not in {"admin", "member"}:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="INVALID_ROLE"
            )

        existing_invitation_result = await session.execute(
            select(WorkspaceInvitation).where(
                WorkspaceInvitation.workspace_id == workspace_id,
                WorkspaceInvitation.email == normalized_email,
                WorkspaceInvitation.status == "pending",
            )
        )
        existing_invitation = existing_invitation_result.scalar_one_or_none()
        if existing_invitation is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="INVITATION_EXISTS")

        raw_token = secrets.token_urlsafe(32)
        invitation = WorkspaceInvitation(
            id=uuid4(),
            workspace_id=workspace_id,
            inviter_id=actor_id,
            email=normalized_email,
            role=normalized_role,
            token_hash=hash_token(raw_token),
            status="pending",
            expires_at=datetime.now(UTC) + timedelta(days=7),
        )
        await WorkspaceInvitationRepository.create(session, invitation=invitation)
        invitation.token = raw_token
        await session.commit()
        return invitation, raw_token

    @staticmethod
    async def list_invitations(
        session: AsyncSession, *, workspace_id: UUID, actor_id: UUID
    ) -> list[WorkspaceInvitation]:
        await WorkspaceService.require_permission(
            session, workspace_id, actor_id, {"owner", "admin"}
        )
        return await WorkspaceInvitationRepository.list_for_workspace(session, workspace_id)

    @staticmethod
    async def revoke_invitation(
        session: AsyncSession,
        *,
        workspace_id: UUID,
        actor_id: UUID,
        invitation_id: UUID,
    ) -> WorkspaceInvitation:
        await WorkspaceService.require_permission(
            session, workspace_id, actor_id, {"owner", "admin"}
        )
        invitation = await WorkspaceInvitationRepository.get_by_id(session, invitation_id)
        if invitation is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="INVITATION_NOT_FOUND"
            )
        if invitation.workspace_id != workspace_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="INVITATION_NOT_FOUND"
            )
        if invitation.status == "revoked":
            return invitation
        invitation = await WorkspaceInvitationRepository.revoke(session, invitation)
        await session.commit()
        return invitation

    @staticmethod
    async def accept_invitation(
        session: AsyncSession,
        *,
        token: str,
        user_id: UUID,
    ) -> tuple[Workspace, WorkspaceMember, WorkspaceInvitation]:
        raw_token = (token or "").strip()
        if not raw_token:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Invitation token is required",
            )

        invitation = await WorkspaceInvitationRepository.get_by_token_hash(
            session,
            hash_token(raw_token),
        )
        if invitation is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="INVITATION_NOT_FOUND"
            )
        if invitation.status in {"revoked", "accepted"}:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail="INVITATION_NOT_ACTIVE"
            )
        if _utc(invitation.expires_at) < datetime.now(UTC):
            await WorkspaceInvitationRepository.mark_expired(session, invitation)
            await session.commit()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="INVITATION_EXPIRED"
            )

        result = await session.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if user is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="USER_NOT_FOUND")
        if invitation.email.lower() != user.email.lower():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="INVITATION_EMAIL_MISMATCH"
            )

        existing_membership = await WorkspaceMemberRepository.get(
            session,
            workspace_id=invitation.workspace_id,
            user_id=user.id,
        )
        if existing_membership is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="USER_ALREADY_MEMBER")

        workspace = await WorkspaceRepository.get_by_id(session, invitation.workspace_id)
        if workspace is None or workspace.is_archived:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="WORKSPACE_NOT_FOUND")

        member = WorkspaceMember(
            id=uuid4(),
            workspace_id=workspace.id,
            user_id=user.id,
            role=invitation.role or "member",
        )
        await WorkspaceMemberRepository.create(session, workspace_member=member)
        invitation.status = "accepted"
        invitation.accepted_at = datetime.now(UTC)
        invitation.updated_at = datetime.now(UTC)
        await session.commit()
        return workspace, member, invitation
