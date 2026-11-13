from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.services.auth.dependencies import get_current_user
from app.services.tags.models import Tag
from app.services.tags.schemas import TagCreateRequest, TagResponse, TagUpdateRequest
from app.services.tags.service import TagService
from app.services.users.models import User

router = APIRouter(prefix="/api/v1", tags=["Tags"])


@router.post(
    "/workspaces/{workspace_id}/tags",
    response_model=TagResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_tag(
    workspace_id: UUID,
    payload: TagCreateRequest,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> TagResponse:
    tag = await TagService.create_tag(
        session,
        workspace_id=workspace_id,
        user_id=current_user.id,
        name=payload.name,
    )
    return TagResponse(
        id=tag.id,
        workspace_id=tag.workspace_id,
        name=tag.name,
        created_at=tag.created_at,
        updated_at=tag.updated_at,
    )


@router.get(
    "/workspaces/{workspace_id}/tags",
    response_model=list[TagResponse],
)
async def list_tags(
    workspace_id: UUID,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> list[TagResponse]:
    tags = await TagService.list_tags(session, workspace_id=workspace_id, user_id=current_user.id)
    return [
        TagResponse(
            id=tag.id,
            workspace_id=tag.workspace_id,
            name=tag.name,
            created_at=tag.created_at,
            updated_at=tag.updated_at,
        )
        for tag in tags
    ]


@router.get(
    "/tags/{tag_id}",
    response_model=TagResponse,
)
async def get_tag(
    tag_id: UUID,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> TagResponse:
    tag = await session.get(Tag, tag_id)
    if tag is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="TAG_NOT_FOUND")
    checked = await TagService.get_tag(
        session,
        workspace_id=tag.workspace_id,
        user_id=current_user.id,
        tag_id=tag_id,
    )
    return TagResponse(
        id=checked.id,
        workspace_id=checked.workspace_id,
        name=checked.name,
        created_at=checked.created_at,
        updated_at=checked.updated_at,
    )


@router.patch(
    "/tags/{tag_id}",
    response_model=TagResponse,
)
async def update_tag(
    tag_id: UUID,
    payload: TagUpdateRequest,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> TagResponse:
    tag = await session.get(Tag, tag_id)
    if tag is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="TAG_NOT_FOUND")
    updated = await TagService.update_tag(
        session,
        workspace_id=tag.workspace_id,
        user_id=current_user.id,
        tag_id=tag_id,
        name=payload.name,
    )
    return TagResponse(
        id=updated.id,
        workspace_id=updated.workspace_id,
        name=updated.name,
        created_at=updated.created_at,
        updated_at=updated.updated_at,
    )


@router.delete(
    "/tags/{tag_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_tag(
    tag_id: UUID,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> None:
    tag = await session.get(Tag, tag_id)
    if tag is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="TAG_NOT_FOUND")
    await TagService.delete_tag(
        session,
        workspace_id=tag.workspace_id,
        user_id=current_user.id,
        tag_id=tag_id,
    )
