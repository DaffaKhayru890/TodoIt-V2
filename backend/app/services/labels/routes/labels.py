from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.services.auth.dependencies import get_current_user
from app.services.labels.models import Label
from app.services.labels.schemas import LabelCreateRequest, LabelResponse, LabelUpdateRequest
from app.services.labels.service import LabelService
from app.services.users.models import User

router = APIRouter(prefix="/api/v1", tags=["Labels"])


@router.post(
    "/workspaces/{workspace_id}/labels",
    response_model=LabelResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_label(
    workspace_id: UUID,
    payload: LabelCreateRequest,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> LabelResponse:
    label = await LabelService.create_label(
        session,
        workspace_id=workspace_id,
        user_id=current_user.id,
        name=payload.name,
        color=payload.color,
    )
    return LabelResponse(
        id=label.id,
        workspace_id=label.workspace_id,
        name=label.name,
        color=label.color,
        created_at=label.created_at,
        updated_at=label.updated_at,
    )


@router.get(
    "/workspaces/{workspace_id}/labels",
    response_model=list[LabelResponse],
)
async def list_labels(
    workspace_id: UUID,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> list[LabelResponse]:
    labels = await LabelService.list_labels(
        session, workspace_id=workspace_id, user_id=current_user.id
    )
    return [
        LabelResponse(
            id=label.id,
            workspace_id=label.workspace_id,
            name=label.name,
            color=label.color,
            created_at=label.created_at,
            updated_at=label.updated_at,
        )
        for label in labels
    ]


@router.get(
    "/labels/{label_id}",
    response_model=LabelResponse,
)
async def get_label(
    label_id: UUID,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> LabelResponse:
    label = await session.get(Label, label_id)
    if label is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="LABEL_NOT_FOUND")
    checked = await LabelService.get_label(
        session,
        workspace_id=label.workspace_id,
        user_id=current_user.id,
        label_id=label_id,
    )
    return LabelResponse(
        id=checked.id,
        workspace_id=checked.workspace_id,
        name=checked.name,
        color=checked.color,
        created_at=checked.created_at,
        updated_at=checked.updated_at,
    )


@router.patch(
    "/labels/{label_id}",
    response_model=LabelResponse,
)
async def update_label(
    label_id: UUID,
    payload: LabelUpdateRequest,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> LabelResponse:
    label = await session.get(Label, label_id)
    if label is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="LABEL_NOT_FOUND")
    updated = await LabelService.update_label(
        session,
        workspace_id=label.workspace_id,
        user_id=current_user.id,
        label_id=label_id,
        name=payload.name,
        color=payload.color,
    )
    return LabelResponse(
        id=updated.id,
        workspace_id=updated.workspace_id,
        name=updated.name,
        color=updated.color,
        created_at=updated.created_at,
        updated_at=updated.updated_at,
    )


@router.delete(
    "/labels/{label_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_label(
    label_id: UUID,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> None:
    label = await session.get(Label, label_id)
    if label is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="LABEL_NOT_FOUND")
    await LabelService.delete_label(
        session,
        workspace_id=label.workspace_id,
        user_id=current_user.id,
        label_id=label_id,
    )
