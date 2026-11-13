from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.services.auth.dependencies import get_current_user
from app.services.todos.schemas import (
    TodoCreateRequest,
    TodoListPage,
    TodoListResponse,
    TodoResponse,
    TodoUpdateRequest,
)
from app.services.todos.service import TodoService
from app.services.users.models import User

router = APIRouter(prefix="/api/v1", tags=["Todos"])


def _todo_response(todo) -> TodoResponse:
    return TodoResponse(
        id=todo.id,
        workspace_id=todo.workspace_id,
        created_by=todo.created_by,
        title=todo.title,
        description=todo.description,
        status=todo.status,
        priority=todo.priority,
        due_at=todo.due_at,
        completed_at=todo.completed_at,
        created_at=todo.created_at,
        updated_at=todo.updated_at,
        tag_ids=[tag.id for tag in todo.tags],
        label_ids=[label.id for label in todo.labels],
    )


@router.post(
    "/workspaces/{workspace_id}/todos",
    response_model=TodoResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a todo",
)
async def create_todo(
    workspace_id: UUID,
    payload: TodoCreateRequest,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> TodoResponse:
    todo = await TodoService.create_todo(
        session,
        workspace_id=workspace_id,
        user_id=current_user.id,
        title=payload.title,
        description=payload.description,
        status=payload.status,
        priority=payload.priority,
        due_at=payload.due_at,
        tag_ids=payload.tag_ids,
        label_ids=payload.label_ids,
    )
    return _todo_response(todo)


@router.get(
    "/workspaces/{workspace_id}/todos",
    response_model=TodoListResponse,
    summary="List todos with filters and pagination",
)
async def list_todos(
    workspace_id: UUID,
    view: str | None = Query(
        default=None, description="View filter: all, today, upcoming, overdue, completed"
    ),
    status: str | None = Query(default=None),
    priority: str | None = Query(default=None),
    due_from: datetime | None = Query(default=None),
    due_to: datetime | None = Query(default=None),
    tag_ids: list[UUID] | None = Query(default=None),
    label_ids: list[UUID] | None = Query(default=None),
    search: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    cursor: str | None = Query(default=None),
    upcoming_days: int = Query(default=7, ge=1, le=30),
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> TodoListResponse:
    items, next_cursor, has_more = await TodoService.list_todos(
        session,
        workspace_id=workspace_id,
        user_id=current_user.id,
        view=view,
        status=status,
        priority=priority,
        due_from=due_from,
        due_to=due_to,
        tag_ids=tag_ids,
        label_ids=label_ids,
        search=search,
        limit=limit,
        cursor=cursor,
        upcoming_days=upcoming_days,
    )
    return TodoListResponse(
        items=[_todo_response(item) for item in items],
        page=TodoListPage(limit=limit, next_cursor=next_cursor, has_more=has_more),
    )


@router.get(
    "/todos/{todo_id}",
    response_model=TodoResponse,
    summary="Get a todo detail",
)
async def get_todo(
    todo_id: UUID,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> TodoResponse:
    todo = await TodoService.get_by_id(session, todo_id)
    if todo is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="TODO_NOT_FOUND")
    await TodoService.get_todo(
        session, workspace_id=todo.workspace_id, user_id=current_user.id, todo_id=todo_id
    )
    return _todo_response(todo)


@router.patch(
    "/todos/{todo_id}",
    response_model=TodoResponse,
    summary="Update a todo",
)
async def update_todo(
    todo_id: UUID,
    payload: TodoUpdateRequest,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> TodoResponse:
    todo = await TodoService.get_by_id(session, todo_id)
    if todo is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="TODO_NOT_FOUND")
    updated = await TodoService.update_todo(
        session,
        workspace_id=todo.workspace_id,
        user_id=current_user.id,
        todo_id=todo_id,
        title=payload.title,
        description=payload.description,
        status=payload.status,
        priority=payload.priority,
        due_at=payload.due_at,
        tag_ids=payload.tag_ids,
        label_ids=payload.label_ids,
    )
    return _todo_response(updated)


@router.delete(
    "/todos/{todo_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a todo",
)
async def delete_todo(
    todo_id: UUID,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> None:
    todo = await TodoService.get_by_id(session, todo_id)
    if todo is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="TODO_NOT_FOUND")
    await TodoService.delete_todo(
        session,
        workspace_id=todo.workspace_id,
        user_id=current_user.id,
        todo_id=todo_id,
    )
