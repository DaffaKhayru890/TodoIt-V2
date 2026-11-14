from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import uuid4

from app.services.labels.models import Label
from app.services.tags.models import Tag
from app.services.todos.models import TodoLabel, TodoTag
from tests.conftest import authenticate
from tests.factories import add_member, create_todo, create_user, create_workspace


async def _add_tag(db_session, workspace, name: str = "backend") -> Tag:
    tag = Tag(id=uuid4(), workspace_id=workspace.id, name=name)
    db_session.add(tag)
    await db_session.flush()
    return tag


async def _add_label(db_session, workspace, name: str = "urgent") -> Label:
    label = Label(id=uuid4(), workspace_id=workspace.id, name=name, color="#FF0000")
    db_session.add(label)
    await db_session.flush()
    return label


async def test_create_todo_with_relationships_and_automatic_reminder(
    api_app,
    api_client,
    db_session,
) -> None:
    owner = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    tag = await _add_tag(db_session, workspace)
    label = await _add_label(db_session, workspace)
    await db_session.commit()
    authenticate(api_app, owner)

    response = await api_client.post(
        f"/api/v1/workspaces/{workspace.id}/todos",
        json={
            "title": "  Ship phase 5  ",
            "description": "  Write docs  ",
            "status": "in_progress",
            "priority": "high",
            "due_at": (datetime.now(UTC) + timedelta(days=2)).isoformat(),
            "tag_ids": [str(tag.id), str(tag.id)],
            "label_ids": [str(label.id)],
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["title"] == "Ship phase 5"
    assert body["description"] == "Write docs"
    assert body["status"] == "in_progress"
    assert body["priority"] == "high"
    assert body["tag_ids"] == [str(tag.id)]
    assert body["label_ids"] == [str(label.id)]
    assert body["created_by"] == str(owner.id)


async def test_create_todo_validation_and_permissions(
    api_app,
    api_client,
    db_session,
) -> None:
    owner = await create_user(db_session)
    outsider = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    other_workspace = await create_workspace(db_session, owner=outsider)
    foreign_tag = await _add_tag(db_session, other_workspace)
    await db_session.commit()

    authenticate(api_app, owner)
    blank = await api_client.post(
        f"/api/v1/workspaces/{workspace.id}/todos",
        json={"title": "   "},
    )
    bad_status = await api_client.post(
        f"/api/v1/workspaces/{workspace.id}/todos",
        json={"title": "Todo", "status": "blocked"},
    )
    bad_priority = await api_client.post(
        f"/api/v1/workspaces/{workspace.id}/todos",
        json={"title": "Todo", "priority": "critical"},
    )
    naive_due = await api_client.post(
        f"/api/v1/workspaces/{workspace.id}/todos",
        json={"title": "Todo", "due_at": "2030-01-01T10:00:00"},
    )
    foreign_tag_response = await api_client.post(
        f"/api/v1/workspaces/{workspace.id}/todos",
        json={"title": "Todo", "tag_ids": [str(foreign_tag.id)]},
    )

    assert blank.status_code == 422
    assert blank.json()["detail"] == "INVALID_TODO_TITLE"
    assert bad_status.status_code == 422
    assert bad_priority.status_code == 422
    assert naive_due.status_code == 422
    assert naive_due.json()["detail"] == "INVALID_DUE_DATE"
    assert foreign_tag_response.status_code == 422
    assert foreign_tag_response.json()["detail"] == "TAG_FROM_DIFFERENT_WORKSPACE"

    authenticate(api_app, outsider)
    forbidden = await api_client.post(
        f"/api/v1/workspaces/{workspace.id}/todos",
        json={"title": "Todo"},
    )
    assert forbidden.status_code == 403


async def test_create_todo_rejects_label_from_other_workspace(
    api_app,
    api_client,
    db_session,
) -> None:
    owner = await create_user(db_session)
    other = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    other_workspace = await create_workspace(db_session, owner=other)
    foreign_label = await _add_label(db_session, other_workspace)
    await db_session.commit()
    authenticate(api_app, owner)

    response = await api_client.post(
        f"/api/v1/workspaces/{workspace.id}/todos",
        json={"title": "Todo", "label_ids": [str(foreign_label.id)]},
    )

    assert response.status_code == 422
    assert response.json()["detail"] == "LABEL_FROM_DIFFERENT_WORKSPACE"


async def test_list_todos_filters_and_search(api_app, api_client, db_session) -> None:
    owner = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    now = datetime.now(UTC)
    tag = await _add_tag(db_session, workspace)
    label = await _add_label(db_session, workspace)
    overdue = await create_todo(
        db_session,
        workspace=workspace,
        creator=owner,
        title="Overdue task",
        due_at=now - timedelta(days=1),
        priority="urgent",
    )
    upcoming = await create_todo(
        db_session,
        workspace=workspace,
        creator=owner,
        title="Upcoming task",
        due_at=now + timedelta(days=2),
        priority="low",
    )
    completed = await create_todo(
        db_session,
        workspace=workspace,
        creator=owner,
        title="Completed task",
        status="completed",
        due_at=now - timedelta(days=2),
    )
    db_session.add(TodoTag(todo_id=overdue.id, tag_id=tag.id))
    db_session.add(TodoLabel(todo_id=upcoming.id, label_id=label.id))
    await db_session.commit()
    authenticate(api_app, owner)

    async def _list(**params):
        response = await api_client.get(
            f"/api/v1/workspaces/{workspace.id}/todos",
            params=params,
        )
        assert response.status_code == 200, response.text
        return response.json()

    all_items = await _list()
    assert {item["title"] for item in all_items["items"]} == {
        "Overdue task",
        "Upcoming task",
        "Completed task",
    }

    completed_view = await _list(view="completed")
    assert [item["title"] for item in completed_view["items"]] == ["Completed task"]

    overdue_view = await _list(view="overdue")
    assert [item["title"] for item in overdue_view["items"]] == ["Overdue task"]

    today_view = await _list(view="today")
    assert today_view["items"] == []

    upcoming_view = await _list(view="upcoming")
    assert [item["title"] for item in upcoming_view["items"]] == ["Upcoming task"]

    priority_filter = await _list(priority="urgent")
    assert [item["title"] for item in priority_filter["items"]] == ["Overdue task"]

    status_filter = await _list(status="todo")
    assert {item["title"] for item in status_filter["items"]} == {"Overdue task", "Upcoming task"}

    search = await _list(search="upcoming")
    assert [item["title"] for item in search["items"]] == ["Upcoming task"]

    tag_filter = await _list(tag_ids=str(tag.id))
    assert [item["title"] for item in tag_filter["items"]] == ["Overdue task"]

    label_filter = await _list(label_ids=str(label.id))
    assert [item["title"] for item in label_filter["items"]] == ["Upcoming task"]

    due_filter = await _list(
        due_from=(now - timedelta(hours=36)).isoformat(),
        due_to=(now + timedelta(days=3)).isoformat(),
    )
    assert {item["title"] for item in due_filter["items"]} == {"Overdue task", "Upcoming task"}

    all_view = await _list(view="all")
    assert len(all_view["items"]) == 3

    upcoming_days = await _list(view="upcoming", upcoming_days=30)
    assert len(upcoming_days["items"]) == 1

    assert completed.id and upcoming.id


async def test_list_todos_validation_errors(api_app, api_client, db_session) -> None:
    owner = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    await db_session.commit()
    authenticate(api_app, owner)

    async def _get(**params):
        return await api_client.get(
            f"/api/v1/workspaces/{workspace.id}/todos",
            params=params,
        )

    invalid_view = await _get(view="later")
    invalid_status = await _get(status="blocked")
    invalid_priority = await _get(priority="critical")
    invalid_limit = await _get(limit=0)
    invalid_upcoming = await _get(upcoming_days=0)

    assert invalid_view.status_code == 422
    assert invalid_view.json()["detail"] == "INVALID_TODO_VIEW"
    assert invalid_status.status_code == 422
    assert invalid_priority.status_code == 422
    assert invalid_limit.status_code == 422
    assert invalid_upcoming.status_code == 422


async def test_todo_cursor_pagination_and_invalid_cursors(
    api_app,
    api_client,
    db_session,
) -> None:
    owner = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    for index in range(3):
        await create_todo(
            db_session,
            workspace=workspace,
            creator=owner,
            title=f"Todo {index}",
        )
    await db_session.commit()
    authenticate(api_app, owner)

    first = await api_client.get(
        f"/api/v1/workspaces/{workspace.id}/todos",
        params={"limit": 2},
    )
    assert first.status_code == 200
    first_body = first.json()
    assert len(first_body["items"]) == 2
    assert first_body["page"]["has_more"] is True
    cursor = first_body["page"]["next_cursor"]
    assert cursor

    second = await api_client.get(
        f"/api/v1/workspaces/{workspace.id}/todos",
        params={"limit": 2, "cursor": cursor},
    )
    assert second.status_code == 200
    second_body = second.json()
    assert len(second_body["items"]) == 1
    assert second_body["page"]["has_more"] is False
    assert second_body["page"]["next_cursor"] is None
    assert {item["id"] for item in first_body["items"]}.isdisjoint(
        {item["id"] for item in second_body["items"]}
    )

    malformed = await api_client.get(
        f"/api/v1/workspaces/{workspace.id}/todos",
        params={"cursor": "not-a-cursor"},
    )
    tampered = await api_client.get(
        f"/api/v1/workspaces/{workspace.id}/todos",
        params={"cursor": cursor + "x"},
    )
    mismatched = await api_client.get(
        f"/api/v1/workspaces/{workspace.id}/todos",
        params={"cursor": cursor, "view": "completed"},
    )

    assert malformed.status_code == 400
    assert malformed.json()["detail"] == "INVALID_CURSOR"
    assert tampered.status_code == 400
    assert tampered.json()["detail"] == "CURSOR_SIGNATURE_INVALID"
    assert mismatched.status_code == 400
    assert mismatched.json()["detail"] == "CURSOR_FILTER_MISMATCH"


async def test_get_todo_detail_and_isolation(api_app, api_client, db_session) -> None:
    owner = await create_user(db_session)
    other = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    other_workspace = await create_workspace(db_session, owner=other)
    todo = await create_todo(db_session, workspace=workspace, creator=owner)
    foreign_todo = await create_todo(db_session, workspace=other_workspace, creator=other)
    await db_session.commit()

    authenticate(api_app, owner)
    found = await api_client.get(f"/api/v1/todos/{todo.id}")
    missing = await api_client.get("/api/v1/todos/00000000-0000-0000-0000-000000000000")
    forbidden = await api_client.get(f"/api/v1/todos/{foreign_todo.id}")

    assert found.status_code == 200
    assert found.json()["id"] == str(todo.id)
    assert missing.status_code == 404
    assert missing.json()["detail"] == "TODO_NOT_FOUND"
    assert forbidden.status_code == 403


async def test_update_todo_full_lifecycle(api_app, api_client, db_session) -> None:
    owner = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    tag = await _add_tag(db_session, workspace)
    label = await _add_label(db_session, workspace)
    todo = await create_todo(db_session, workspace=workspace, creator=owner)
    await db_session.commit()
    authenticate(api_app, owner)

    updated = await api_client.patch(
        f"/api/v1/todos/{todo.id}",
        json={
            "title": "  Updated title  ",
            "description": "  Updated description  ",
            "priority": "urgent",
            "due_at": (datetime.now(UTC) + timedelta(days=1)).isoformat(),
            "tag_ids": [str(tag.id)],
            "label_ids": [str(label.id)],
        },
    )
    assert updated.status_code == 200
    body = updated.json()
    assert body["title"] == "Updated title"
    assert body["description"] == "Updated description"
    assert body["priority"] == "urgent"
    assert body["tag_ids"] == [str(tag.id)]
    assert body["label_ids"] == [str(label.id)]

    completed = await api_client.patch(
        f"/api/v1/todos/{todo.id}",
        json={"status": "completed"},
    )
    assert completed.status_code == 200
    assert completed.json()["status"] == "completed"
    assert completed.json()["completed_at"] is not None

    reopened = await api_client.patch(
        f"/api/v1/todos/{todo.id}",
        json={"status": "todo", "description": "   "},
    )
    assert reopened.status_code == 200
    assert reopened.json()["status"] == "todo"
    assert reopened.json()["completed_at"] is None
    assert reopened.json()["description"] is None

    cleared = await api_client.patch(
        f"/api/v1/todos/{todo.id}",
        json={"due_at": None},
    )
    assert cleared.status_code == 200
    assert cleared.json()["due_at"] is None


async def test_update_todo_validation_errors(api_app, api_client, db_session) -> None:
    owner = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    todo = await create_todo(db_session, workspace=workspace, creator=owner)
    await db_session.commit()
    authenticate(api_app, owner)

    blank_title = await api_client.patch(f"/api/v1/todos/{todo.id}", json={"title": "   "})
    bad_status = await api_client.patch(f"/api/v1/todos/{todo.id}", json={"status": "blocked"})
    bad_priority = await api_client.patch(f"/api/v1/todos/{todo.id}", json={"priority": "critical"})
    naive_due = await api_client.patch(
        f"/api/v1/todos/{todo.id}", json={"due_at": "2030-01-01T10:00:00"}
    )
    missing = await api_client.patch(
        "/api/v1/todos/00000000-0000-0000-0000-000000000000",
        json={"title": "Nope"},
    )

    assert blank_title.status_code == 422
    assert blank_title.json()["detail"] == "INVALID_TODO_TITLE"
    assert bad_status.status_code == 422
    assert bad_priority.status_code == 422
    assert naive_due.status_code == 422
    assert naive_due.json()["detail"] == "INVALID_DUE_DATE"
    assert missing.status_code == 404


async def test_update_todo_requires_membership(api_app, api_client, db_session) -> None:
    owner = await create_user(db_session)
    outsider = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    todo = await create_todo(db_session, workspace=workspace, creator=owner)
    await db_session.commit()
    authenticate(api_app, outsider)

    response = await api_client.patch(f"/api/v1/todos/{todo.id}", json={"title": "Hijack"})

    assert response.status_code == 403


async def test_member_can_update_shared_todo(api_app, api_client, db_session) -> None:
    owner = await create_user(db_session)
    member = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    await add_member(db_session, workspace=workspace, user=member, role="member")
    todo = await create_todo(db_session, workspace=workspace, creator=owner)
    await db_session.commit()
    authenticate(api_app, member)

    response = await api_client.patch(
        f"/api/v1/todos/{todo.id}",
        json={"priority": "low"},
    )

    assert response.status_code == 200
    assert response.json()["priority"] == "low"


async def test_delete_todo(api_app, api_client, db_session) -> None:
    owner = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    todo = await create_todo(db_session, workspace=workspace, creator=owner)
    await db_session.commit()
    authenticate(api_app, owner)

    deleted = await api_client.delete(f"/api/v1/todos/{todo.id}")
    missing = await api_client.delete(f"/api/v1/todos/{todo.id}")
    unknown = await api_client.delete("/api/v1/todos/00000000-0000-0000-0000-000000000000")

    assert deleted.status_code == 204
    assert missing.status_code == 404
    assert unknown.status_code == 404

    after = await api_client.get(f"/api/v1/todos/{todo.id}")
    assert after.status_code == 404
