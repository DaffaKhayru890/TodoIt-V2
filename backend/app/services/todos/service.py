from __future__ import annotations

import base64
import hashlib
import hmac
import json
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import HTTPException, status
from sqlalchemy import exists, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.services.labels.models import Label
from app.services.tags.models import Tag
from app.services.todos.models import Todo, TodoLabel, TodoTag
from app.services.todos.repository import TodoRepository
from app.services.workspaces.service import WorkspaceService

VALID_STATUSES = {"todo", "in_progress", "completed"}
VALID_PRIORITIES = {"low", "medium", "high", "urgent"}
VALID_VIEWS = {"all", "today", "upcoming", "overdue", "completed"}


def _utc_now() -> datetime:
    return datetime.now(UTC)


def _as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        raise ValueError("datetime values must be timezone-aware")
    return value.astimezone(UTC)


class TodoService:
    @staticmethod
    def _normalise_tag_ids(tag_ids: list[UUID] | None) -> list[UUID]:
        seen: set[UUID] = set()
        values: list[UUID] = []
        for item in tag_ids or []:
            if item in seen:
                continue
            seen.add(item)
            values.append(item)
        return values

    @staticmethod
    def _normalise_label_ids(label_ids: list[UUID] | None) -> list[UUID]:
        seen: set[UUID] = set()
        values: list[UUID] = []
        for item in label_ids or []:
            if item in seen:
                continue
            seen.add(item)
            values.append(item)
        return values

    @staticmethod
    async def _ensure_workspace_tag_ids(
        session: AsyncSession,
        workspace_id: UUID,
        tag_ids: list[UUID] | None,
    ) -> list[Tag]:
        values = TodoService._normalise_tag_ids(tag_ids)
        if not values:
            return []
        result = await session.execute(
            select(Tag).where(Tag.id.in_(values), Tag.workspace_id == workspace_id)
        )
        tags = list(result.scalars().all())
        if len(tags) != len(values):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="TAG_FROM_DIFFERENT_WORKSPACE",
            )
        return tags

    @staticmethod
    async def _ensure_workspace_label_ids(
        session: AsyncSession,
        workspace_id: UUID,
        label_ids: list[UUID] | None,
    ) -> list[Label]:
        values = TodoService._normalise_label_ids(label_ids)
        if not values:
            return []
        result = await session.execute(
            select(Label).where(Label.id.in_(values), Label.workspace_id == workspace_id)
        )
        labels = list(result.scalars().all())
        if len(labels) != len(values):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="LABEL_FROM_DIFFERENT_WORKSPACE",
            )
        return labels

    @staticmethod
    async def _assign_relationships(
        session: AsyncSession,
        todo: Todo,
        *,
        tag_ids: list[UUID] | None = None,
        label_ids: list[UUID] | None = None,
    ) -> None:
        if tag_ids is not None:
            todo.tags = []
            for tag in await TodoService._ensure_workspace_tag_ids(
                session, todo.workspace_id, tag_ids
            ):
                todo.tags.append(tag)
        if label_ids is not None:
            todo.labels = []
            for label in await TodoService._ensure_workspace_label_ids(
                session, todo.workspace_id, label_ids
            ):
                todo.labels.append(label)

    @staticmethod
    async def create_todo(
        session: AsyncSession,
        *,
        workspace_id: UUID,
        user_id: UUID,
        title: str,
        description: str | None,
        status: str = "todo",
        priority: str = "medium",
        due_at: datetime | None,
        tag_ids: list[UUID] | None = None,
        label_ids: list[UUID] | None = None,
    ) -> Todo:
        await WorkspaceService.require_access(session, workspace_id, user_id)
        cleaned_title = (title or "").strip()
        if not cleaned_title:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="INVALID_TODO_TITLE"
            )
        if status not in VALID_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="INVALID_TODO_STATUS"
            )
        if priority not in VALID_PRIORITIES:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="INVALID_TODO_PRIORITY"
            )
        if due_at is not None and due_at.tzinfo is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="INVALID_DUE_DATE"
            )

        todo = Todo(
            workspace_id=workspace_id,
            created_by=user_id,
            title=cleaned_title,
            description=description.strip() if description and description.strip() else None,
            status=status,
            priority=priority,
            due_at=_as_utc(due_at),
        )
        session.add(todo)
        await session.flush()

        await TodoService._assign_relationships(session, todo, tag_ids=tag_ids, label_ids=label_ids)
        await session.commit()
        return todo

    @staticmethod
    async def get_todo(
        session: AsyncSession, *, workspace_id: UUID, user_id: UUID, todo_id: UUID
    ) -> Todo:
        await WorkspaceService.require_access(session, workspace_id, user_id)
        todo = await TodoService.get_by_id(session, todo_id)
        if todo is None or todo.workspace_id != workspace_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="TODO_NOT_FOUND")
        return todo

    @staticmethod
    async def get_by_id(session: AsyncSession, todo_id: UUID) -> Todo | None:
        result = await session.execute(select(Todo).where(Todo.id == todo_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def list_todos(
        session: AsyncSession,
        *,
        workspace_id: UUID,
        user_id: UUID,
        view: str | None = None,
        status: str | None = None,
        priority: str | None = None,
        due_from: datetime | None = None,
        due_to: datetime | None = None,
        tag_ids: list[UUID] | None = None,
        label_ids: list[UUID] | None = None,
        search: str | None = None,
        limit: int = 20,
        cursor: str | None = None,
        upcoming_days: int = 7,
    ) -> tuple[list[Todo], str | None, bool]:
        await WorkspaceService.require_access(session, workspace_id, user_id)
        if view not in (None, *sorted(VALID_VIEWS)):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="INVALID_TODO_VIEW"
            )
        if status is not None and status not in VALID_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="INVALID_TODO_STATUS"
            )
        if priority is not None and priority not in VALID_PRIORITIES:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="INVALID_TODO_PRIORITY"
            )
        if limit < 1 or limit > settings.todo_max_limit:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="INVALID_PAGINATION_LIMIT"
            )
        if upcoming_days < 1 or upcoming_days > settings.max_upcoming_days:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="INVALID_UPCOMING_DAYS"
            )

        query = select(Todo).where(Todo.workspace_id == workspace_id)
        filter_hash = TodoService._filter_hash(
            workspace_id=workspace_id,
            view=view,
            status=status,
            priority=priority,
            due_from=due_from,
            due_to=due_to,
            tag_ids=tag_ids,
            label_ids=label_ids,
            search=search,
            upcoming_days=upcoming_days,
        )

        if cursor:
            payload = TodoService._decode_cursor(cursor)
            if payload["filter_hash"] != filter_hash:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST, detail="CURSOR_FILTER_MISMATCH"
                )
            query = query.where(
                (Todo.created_at < payload["created_at"])
                | ((Todo.created_at == payload["created_at"]) & (Todo.id < payload["id"]))
            )

        if view == "completed":
            query = query.where(Todo.status == "completed")
        elif view == "overdue":
            now_utc = _utc_now()
            query = query.where(
                Todo.due_at.is_not(None), Todo.due_at < now_utc, Todo.status != "completed"
            )
        elif view == "today":
            tz = ZoneInfo(user_id.hex if False else settings.default_timezone)
            # Fallback to default timezone because user timezone is configured on the user model.
            local_today = datetime.now(tz)
            start_local = local_today.replace(hour=0, minute=0, second=0, microsecond=0)
            next_local = start_local + timedelta(days=1)
            start_utc = start_local.astimezone(UTC)
            next_utc = next_local.astimezone(UTC)
            query = query.where(
                Todo.due_at.is_not(None),
                Todo.due_at >= start_utc,
                Todo.due_at < next_utc,
                Todo.status != "completed",
            )
        elif view == "upcoming":
            tz = ZoneInfo(settings.default_timezone)
            now_local = datetime.now(tz)
            start_local = (now_local + timedelta(days=1)).replace(
                hour=0, minute=0, second=0, microsecond=0
            )
            end_local = (start_local + timedelta(days=upcoming_days)).replace(
                hour=0, minute=0, second=0, microsecond=0
            )
            query = query.where(
                Todo.due_at.is_not(None),
                Todo.due_at >= start_local.astimezone(UTC),
                Todo.due_at < end_local.astimezone(UTC),
                Todo.status != "completed",
            )
        elif view == "all":
            pass

        if status is not None:
            query = query.where(Todo.status == status)
        if priority is not None:
            query = query.where(Todo.priority == priority)
        if due_from is not None:
            query = query.where(Todo.due_at >= _as_utc(due_from))
        if due_to is not None:
            query = query.where(Todo.due_at < _as_utc(due_to))
        if search:
            search_term = f"%{search.strip()}%"
            query = query.where(
                or_(Todo.title.ilike(search_term), Todo.description.ilike(search_term))
            )
        if tag_ids:
            value_ids = TodoService._normalise_tag_ids(tag_ids)
            query = query.where(
                exists(
                    select(TodoTag.tag_id).where(
                        TodoTag.tag_id.in_(value_ids), TodoTag.todo_id == Todo.id
                    )
                )
            )
        if label_ids:
            value_ids = TodoService._normalise_label_ids(label_ids)
            query = query.where(
                exists(
                    select(TodoLabel.label_id).where(
                        TodoLabel.label_id.in_(value_ids), TodoLabel.todo_id == Todo.id
                    )
                )
            )

        query = query.order_by(Todo.created_at.desc(), Todo.id.desc())
        items = list((await session.execute(query.limit(limit + 1))).scalars().all())
        has_more = len(items) > limit
        if has_more:
            items = items[:limit]
            next_cursor = TodoService._encode_cursor(
                items[-1].created_at, items[-1].id, filter_hash
            )
        else:
            next_cursor = None
        return items, next_cursor, has_more

    @staticmethod
    def _filter_hash(
        *,
        workspace_id: UUID,
        view: str | None,
        status: str | None,
        priority: str | None,
        due_from: datetime | None,
        due_to: datetime | None,
        tag_ids: list[UUID] | None,
        label_ids: list[UUID] | None,
        search: str | None,
        upcoming_days: int,
    ) -> str:
        payload = {
            "workspace_id": str(workspace_id),
            "view": view,
            "status": status,
            "priority": priority,
            "due_from": due_from.isoformat() if due_from else None,
            "due_to": due_to.isoformat() if due_to else None,
            "tag_ids": [str(x) for x in TodoService._normalise_tag_ids(tag_ids)],
            "label_ids": [str(x) for x in TodoService._normalise_label_ids(label_ids)],
            "search": search.strip() if search else None,
            "upcoming_days": upcoming_days,
        }
        encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
        return hashlib.sha256(encoded.encode("utf-8")).hexdigest()

    @staticmethod
    def _encode_cursor(created_at: datetime, todo_id: UUID, filter_hash: str) -> str:
        payload = {
            "version": 1,
            "created_at": created_at.astimezone(UTC).isoformat(),
            "id": str(todo_id),
            "filter_hash": filter_hash,
        }
        raw = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
        digest = hmac.new(
            settings.pagination_cursor_secret.get_secret_value().encode("utf-8"),
            raw,
            hashlib.sha256,
        ).digest()
        encoded = (
            base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")
            + "."
            + base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")
        )
        return encoded

    @staticmethod
    def _decode_cursor(cursor: str) -> dict[str, Any]:
        try:
            payload_b64, sig_b64 = cursor.split(".", 1)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="INVALID_CURSOR"
            ) from exc
        try:
            raw_payload = base64.urlsafe_b64decode(payload_b64 + "=" * (-len(payload_b64) % 4))
            expected_sig = base64.urlsafe_b64decode(sig_b64 + "=" * (-len(sig_b64) % 4))
        except Exception as exc:  # pragma: no cover - defensive validation
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="INVALID_CURSOR"
            ) from exc

        digest = hmac.new(
            settings.pagination_cursor_secret.get_secret_value().encode("utf-8"),
            raw_payload,
            hashlib.sha256,
        ).digest()
        if not hmac.compare_digest(digest, expected_sig):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="CURSOR_SIGNATURE_INVALID"
            )

        try:
            payload = json.loads(raw_payload.decode("utf-8"))
        except Exception as exc:  # pragma: no cover - defensive validation
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="INVALID_CURSOR"
            ) from exc

        if payload.get("version") != 1:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="INVALID_CURSOR")
        if "created_at" not in payload or "id" not in payload or "filter_hash" not in payload:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="INVALID_CURSOR")
        try:
            created_at = datetime.fromisoformat(payload["created_at"]).astimezone(UTC)
            todo_id = UUID(payload["id"])
        except Exception as exc:  # pragma: no cover - defensive validation
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="INVALID_CURSOR"
            ) from exc

        return {"created_at": created_at, "id": todo_id, "filter_hash": payload["filter_hash"]}

    @staticmethod
    async def update_todo(
        session: AsyncSession,
        *,
        workspace_id: UUID,
        user_id: UUID,
        todo_id: UUID,
        title: str | None,
        description: str | None,
        status: str | None,
        priority: str | None,
        due_at: datetime | None,
        tag_ids: list[UUID] | None,
        label_ids: list[UUID] | None,
    ) -> Todo:
        todo = await TodoService.get_todo(
            session, workspace_id=workspace_id, user_id=user_id, todo_id=todo_id
        )
        if title is not None:
            cleaned = title.strip()
            if not cleaned:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="INVALID_TODO_TITLE"
                )
            todo.title = cleaned
        if description is not None:
            todo.description = description.strip() if description.strip() else None
        if status is not None:
            if status not in VALID_STATUSES:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="INVALID_TODO_STATUS"
                )
            todo.status = status
            if status == "completed" and todo.completed_at is None:
                todo.completed_at = _utc_now()
            if status != "completed":
                todo.completed_at = None
        if priority is not None:
            if priority not in VALID_PRIORITIES:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="INVALID_TODO_PRIORITY"
                )
            todo.priority = priority
        if due_at is not None:
            if due_at.tzinfo is None:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="INVALID_DUE_DATE"
                )
            todo.due_at = _as_utc(due_at)
        if tag_ids is not None:
            await TodoService._assign_relationships(session, todo, tag_ids=tag_ids)
        if label_ids is not None:
            await TodoService._assign_relationships(session, todo, label_ids=label_ids)

        todo.updated_at = _utc_now()
        await session.commit()
        return todo

    @staticmethod
    async def delete_todo(
        session: AsyncSession, *, workspace_id: UUID, user_id: UUID, todo_id: UUID
    ) -> None:
        todo = await TodoService.get_todo(
            session, workspace_id=workspace_id, user_id=user_id, todo_id=todo_id
        )
        await TodoRepository.delete(session, todo)
        await session.commit()
