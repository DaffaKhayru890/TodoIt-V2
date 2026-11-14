from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from app.common.enums import AppEnvironment
from app.common.response import error_response, success_response
from app.common.utils import utc_now
from app.core.dependencies import get_db
from app.services.todos.models import Todo
from app.services.todos.repository import TodoRepository
from tests.factories import create_todo, create_user, create_workspace


def test_success_response_shapes() -> None:
    assert success_response() == {"success": True, "message": "success"}
    assert success_response({"id": "1"}, message="created") == {
        "success": True,
        "message": "created",
        "data": {"id": "1"},
    }


def test_error_response_shapes() -> None:
    assert error_response("bad", "Something failed") == {
        "success": False,
        "error": {"code": "bad", "message": "Something failed"},
    }
    assert error_response("bad", "Something failed", request_id="req-1") == {
        "success": False,
        "error": {
            "code": "bad",
            "message": "Something failed",
            "request_id": "req-1",
        },
    }


def test_app_environment_values() -> None:
    assert {item.value for item in AppEnvironment} == {
        "development",
        "test",
        "staging",
        "production",
    }


def test_utc_now_is_timezone_aware() -> None:
    value = utc_now()
    assert value.tzinfo is UTC


async def test_get_db_dependency_yields_session() -> None:
    generator = get_db()
    session = await anext(generator)
    assert isinstance(session, AsyncSession)
    await generator.aclose()


async def test_todo_repository_crud(db_session) -> None:
    owner = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    await db_session.commit()

    todo = Todo(
        id=uuid4(),
        workspace_id=workspace.id,
        created_by=owner.id,
        title="Repository todo",
    )
    created = await TodoRepository.create(db_session, todo=todo)
    assert created.id == todo.id

    fetched = await TodoRepository.get_by_id(db_session, todo.id)
    assert fetched is not None
    assert fetched.title == "Repository todo"

    listed = await TodoRepository.list_for_workspace(db_session, workspace.id)
    assert [item.id for item in listed] == [todo.id]

    older = await create_todo(db_session, workspace=workspace, creator=owner, title="Older")
    older.created_at = datetime.now(UTC) - timedelta(minutes=5)
    await db_session.commit()

    filtered = await TodoRepository.list_for_workspace(
        db_session,
        workspace.id,
        limit=1,
        before_created_at=todo.created_at,
        before_id=todo.id,
    )
    assert [item.id for item in filtered] == [older.id]

    await TodoRepository.delete(db_session, todo)
    assert await TodoRepository.get_by_id(db_session, todo.id) is None
