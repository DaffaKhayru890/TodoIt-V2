from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.services.auth.dependencies import get_current_user
from app.services.users.models import User
from app.services.workspaces.models import Workspace, WorkspaceMember
from app.services.workspaces.schemas import (
    InvitationAcceptRequest,
    InvitationAcceptResponse,
    WorkspaceCreateRequest,
    WorkspaceInvitationCreateRequest,
    WorkspaceInvitationResponse,
    WorkspaceMemberResponse,
    WorkspaceMemberUpdateRequest,
    WorkspaceResponse,
    WorkspaceUpdateRequest,
)
from app.services.workspaces.service import WorkspaceService

workspace_router = APIRouter(prefix="/api/v1/workspaces", tags=["Workspaces"])
legacy_workspace_router = APIRouter(prefix="/workspaces", tags=["Workspaces"])
invitation_router = APIRouter(prefix="/api/v1", tags=["Invitations"])
legacy_invitation_router = APIRouter(tags=["Invitations"])


async def _workspace_member_payload(
    member: WorkspaceMember,
    session: AsyncSession,
) -> WorkspaceMemberResponse:
    user = None
    if member.user_id is not None:
        result = await session.execute(select(User).where(User.id == member.user_id))
        user = result.scalar_one_or_none()
    return WorkspaceMemberResponse(
        id=member.id,
        workspace_id=member.workspace_id,
        user_id=member.user_id,
        role=member.role,
        joined_at=member.joined_at,
        created_at=member.created_at,
        updated_at=member.updated_at,
        user_email=str(user.email) if user else None,
        full_name=user.full_name if user else None,
    )


@workspace_router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    response_model=WorkspaceResponse,
    summary="Create a workspace",
)
async def create_workspace(
    payload: WorkspaceCreateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> Workspace:
    return await WorkspaceService.create_workspace(
        session,
        user_id=current_user.id,
        name=payload.name,
        description=payload.description,
    )


@workspace_router.get(
    "", response_model=list[WorkspaceResponse], summary="List the current user's workspaces"
)
async def list_workspaces(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[Workspace]:
    return await WorkspaceService.list_workspaces(session, user_id=current_user.id)


@workspace_router.get(
    "/{workspace_id}",
    response_model=WorkspaceResponse,
    summary="Get a workspace detail",
)
async def get_workspace(
    workspace_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> Workspace:
    return await WorkspaceService.get_workspace_for_user(
        session,
        workspace_id=workspace_id,
        user_id=current_user.id,
    )


@workspace_router.patch(
    "/{workspace_id}",
    response_model=WorkspaceResponse,
    summary="Update a workspace",
)
async def update_workspace(
    workspace_id: UUID,
    payload: WorkspaceUpdateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> Workspace:
    return await WorkspaceService.update_workspace(
        session,
        workspace_id=workspace_id,
        actor_id=current_user.id,
        name=payload.name,
        description=payload.description,
    )


@workspace_router.delete(
    "/{workspace_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Archive a workspace",
)
async def archive_workspace(
    workspace_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> None:
    await WorkspaceService.archive_workspace(
        session,
        workspace_id=workspace_id,
        actor_id=current_user.id,
    )


@legacy_workspace_router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    response_model=WorkspaceResponse,
    summary="Create a workspace",
)
async def legacy_create_workspace(
    payload: WorkspaceCreateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> Workspace:
    return await create_workspace(payload=payload, current_user=current_user, session=session)


@legacy_workspace_router.get(
    "", response_model=list[WorkspaceResponse], summary="List the current user's workspaces"
)
async def legacy_list_workspaces(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[Workspace]:
    return await list_workspaces(current_user=current_user, session=session)


@legacy_workspace_router.get(
    "/{workspace_id}",
    response_model=WorkspaceResponse,
    summary="Get a workspace detail",
)
async def legacy_get_workspace(
    workspace_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> Workspace:
    return await get_workspace(
        workspace_id=workspace_id, current_user=current_user, session=session
    )


@legacy_workspace_router.patch(
    "/{workspace_id}",
    response_model=WorkspaceResponse,
    summary="Update a workspace",
)
async def legacy_update_workspace(
    workspace_id: UUID,
    payload: WorkspaceUpdateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> Workspace:
    return await update_workspace(
        workspace_id=workspace_id,
        payload=payload,
        current_user=current_user,
        session=session,
    )


@legacy_workspace_router.delete(
    "/{workspace_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Archive a workspace",
)
async def legacy_archive_workspace(
    workspace_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> None:
    await archive_workspace(workspace_id=workspace_id, current_user=current_user, session=session)


@workspace_router.get(
    "/{workspace_id}/members",
    response_model=list[WorkspaceMemberResponse],
    summary="List workspace members",
)
async def list_members(
    workspace_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[WorkspaceMemberResponse]:
    members = await WorkspaceService.list_members(
        session,
        workspace_id=workspace_id,
        actor_id=current_user.id,
    )
    return [await _workspace_member_payload(member, session) for member in members]


@workspace_router.patch(
    "/{workspace_id}/members/{user_id}",
    response_model=WorkspaceMemberResponse,
    summary="Update a member role",
)
async def update_member_role(
    workspace_id: UUID,
    user_id: UUID,
    payload: WorkspaceMemberUpdateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> WorkspaceMemberResponse:
    member = await WorkspaceService.update_member_role(
        session,
        workspace_id=workspace_id,
        actor_id=current_user.id,
        target_user_id=user_id,
        new_role=payload.role,
    )
    return await _workspace_member_payload(member, session)


@workspace_router.delete(
    "/{workspace_id}/members/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a workspace member",
)
async def remove_member(
    workspace_id: UUID,
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> None:
    await WorkspaceService.remove_member(
        session,
        workspace_id=workspace_id,
        actor_id=current_user.id,
        target_user_id=user_id,
    )


@legacy_workspace_router.get(
    "/{workspace_id}/members",
    response_model=list[WorkspaceMemberResponse],
    summary="List workspace members",
)
async def legacy_list_members(
    workspace_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[WorkspaceMemberResponse]:
    return await list_members(workspace_id=workspace_id, current_user=current_user, session=session)


@legacy_workspace_router.patch(
    "/{workspace_id}/members/{user_id}",
    response_model=WorkspaceMemberResponse,
    summary="Update a member role",
)
async def legacy_update_member_role(
    workspace_id: UUID,
    user_id: UUID,
    payload: WorkspaceMemberUpdateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> WorkspaceMemberResponse:
    return await update_member_role(
        workspace_id=workspace_id,
        user_id=user_id,
        payload=payload,
        current_user=current_user,
        session=session,
    )


@legacy_workspace_router.delete(
    "/{workspace_id}/members/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a workspace member",
)
async def legacy_remove_member(
    workspace_id: UUID,
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> None:
    await remove_member(
        workspace_id=workspace_id, user_id=user_id, current_user=current_user, session=session
    )


@workspace_router.post(
    "/{workspace_id}/invitations",
    response_model=WorkspaceInvitationResponse,
    summary="Create a workspace invitation",
)
async def create_invitation(
    workspace_id: UUID,
    payload: WorkspaceInvitationCreateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> WorkspaceInvitationResponse:
    invitation, raw_token = await WorkspaceService.create_invitation(
        session,
        workspace_id=workspace_id,
        actor_id=current_user.id,
        email=payload.email,
        role=payload.role,
    )
    return WorkspaceInvitationResponse(
        id=invitation.id,
        workspace_id=invitation.workspace_id,
        inviter_id=invitation.inviter_id,
        email=invitation.email,
        role=invitation.role,
        status=invitation.status,
        expires_at=invitation.expires_at,
        accepted_at=invitation.accepted_at,
        created_at=invitation.created_at,
        updated_at=invitation.updated_at,
        token=raw_token,
    )


@workspace_router.get(
    "/{workspace_id}/invitations",
    response_model=list[WorkspaceInvitationResponse],
    summary="List workspace invitations",
)
async def list_invitations(
    workspace_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[WorkspaceInvitationResponse]:
    invitations = await WorkspaceService.list_invitations(
        session,
        workspace_id=workspace_id,
        actor_id=current_user.id,
    )
    return [
        WorkspaceInvitationResponse(
            id=item.id,
            workspace_id=item.workspace_id,
            inviter_id=item.inviter_id,
            email=item.email,
            role=item.role,
            status=item.status,
            expires_at=item.expires_at,
            accepted_at=item.accepted_at,
            created_at=item.created_at,
            updated_at=item.updated_at,
            token=None,
        )
        for item in invitations
    ]


@workspace_router.delete(
    "/{workspace_id}/invitations/{invitation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Revoke an invitation",
)
async def revoke_invitation(
    workspace_id: UUID,
    invitation_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> None:
    await WorkspaceService.revoke_invitation(
        session,
        workspace_id=workspace_id,
        actor_id=current_user.id,
        invitation_id=invitation_id,
    )


@legacy_workspace_router.post(
    "/{workspace_id}/invitations",
    response_model=WorkspaceInvitationResponse,
    summary="Create a workspace invitation",
)
async def legacy_create_invitation(
    workspace_id: UUID,
    payload: WorkspaceInvitationCreateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> WorkspaceInvitationResponse:
    return await create_invitation(
        workspace_id=workspace_id,
        payload=payload,
        current_user=current_user,
        session=session,
    )


@legacy_workspace_router.get(
    "/{workspace_id}/invitations",
    response_model=list[WorkspaceInvitationResponse],
    summary="List workspace invitations",
)
async def legacy_list_invitations(
    workspace_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[WorkspaceInvitationResponse]:
    return await list_invitations(
        workspace_id=workspace_id, current_user=current_user, session=session
    )


@legacy_workspace_router.delete(
    "/{workspace_id}/invitations/{invitation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Revoke an invitation",
)
async def legacy_revoke_invitation(
    workspace_id: UUID,
    invitation_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> None:
    await revoke_invitation(
        workspace_id=workspace_id,
        invitation_id=invitation_id,
        current_user=current_user,
        session=session,
    )


@invitation_router.post(
    "/invitations/accept",
    response_model=InvitationAcceptResponse,
    summary="Accept a workspace invitation",
)
async def accept_invitation(
    payload: InvitationAcceptRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> InvitationAcceptResponse:
    workspace, member, invitation = await WorkspaceService.accept_invitation(
        session,
        token=payload.token,
        user_id=current_user.id,
    )
    result_user = None
    if member.user_id is not None:
        result = await session.execute(select(User).where(User.id == member.user_id))
        result_user = result.scalar_one_or_none()
    response_member = WorkspaceMemberResponse(
        id=member.id,
        workspace_id=member.workspace_id,
        user_id=member.user_id,
        role=member.role,
        joined_at=member.joined_at,
        created_at=member.created_at,
        updated_at=member.updated_at,
        user_email=str(result_user.email) if result_user else None,
        full_name=result_user.full_name if result_user else None,
    )
    return InvitationAcceptResponse(
        workspace_id=workspace.id,
        workspace_name=workspace.name,
        role=member.role,
        member=response_member,
    )


@legacy_invitation_router.post(
    "/invitations/accept",
    response_model=InvitationAcceptResponse,
    summary="Accept a workspace invitation",
)
async def legacy_accept_invitation(
    payload: InvitationAcceptRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> InvitationAcceptResponse:
    return await accept_invitation(payload=payload, current_user=current_user, session=session)
