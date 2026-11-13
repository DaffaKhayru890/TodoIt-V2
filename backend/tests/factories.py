from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.auth.security import hash_password
from app.services.notifications.models import Notification
from app.services.reminders.models import Reminder
from app.services.todos.models import Todo
from app.services.users.models import User
from app.services.workspaces.models import Workspace, WorkspaceMember


async def create_user(
    session: AsyncSession,
    *,
    email: str | None = None,
    full_name: str = "Test User",
    is_active: bool = True,
    timezone: str = "UTC",
) -> User:
    user = User(
        id=uuid4(),
        email=email or f"user-{uuid4().hex[:8]}@example.com",
        password_hash=hash_password("secure-password-123"),
        full_name=full_name,
        timezone=timezone,
        is_active=is_active,
    )
    session.add(user)
    await session.flush()
    return user


async def create_workspace(
    session: AsyncSession,
    *,
    owner: User,
    name: str = "Test Workspace",
    is_archived: bool = False,
) -> Workspace:
    workspace = Workspace(
        id=uuid4(),
        name=name,
        owner_id=owner.id,
        is_archived=is_archived,
    )
    session.add(workspace)
    await session.flush()
    session.add(
        WorkspaceMember(
            id=uuid4(),
            workspace_id=workspace.id,
            user_id=owner.id,
            role="owner",
        )
    )
    await session.flush()
    return workspace


async def add_member(
    session: AsyncSession,
    *,
    workspace: Workspace,
    user: User,
    role: str = "member",
) -> WorkspaceMember:
    member = WorkspaceMember(
        id=uuid4(),
        workspace_id=workspace.id,
        user_id=user.id,
        role=role,
    )
    session.add(member)
    await session.flush()
    return member


async def create_todo(
    session: AsyncSession,
    *,
    workspace: Workspace,
    creator: User,
    title: str = "Finish backend project",
    status: str = "todo",
    due_at: datetime | None = None,
    priority: str = "medium",
) -> Todo:
    todo = Todo(
        id=uuid4(),
        workspace_id=workspace.id,
        created_by=creator.id,
        title=title,
        status=status,
        priority=priority,
        due_at=due_at,
        completed_at=datetime.now(UTC) if status == "completed" else None,
    )
    session.add(todo)
    await session.flush()
    return todo


async def create_reminder(
    session: AsyncSession,
    *,
    todo: Todo,
    user: User,
    remind_at: datetime | None = None,
    source: str = "manual",
    status: str = "pending",
    processed_at: datetime | None = None,
) -> Reminder:
    if remind_at is None:
        remind_at = datetime.now(UTC) + timedelta(hours=1)
    if status == "processed" and processed_at is None:
        processed_at = datetime.now(UTC)
    reminder = Reminder(
        id=uuid4(),
        todo_id=todo.id,
        user_id=user.id,
        source=source,
        status=status,
        remind_at=remind_at,
        processed_at=processed_at,
    )
    session.add(reminder)
    await session.flush()
    return reminder


async def create_notification(
    session: AsyncSession,
    *,
    user: User,
    todo: Todo | None = None,
    reminder: Reminder | None = None,
    title: str = "Todo Reminder",
    message: str = "Reminder: Finish backend project",
    notification_type: str = "todo_reminder",
    is_read: bool = False,
    created_at: datetime | None = None,
) -> Notification:
    notification = Notification(
        id=uuid4(),
        user_id=user.id,
        todo_id=todo.id if todo else None,
        reminder_id=reminder.id if reminder else None,
        title=title,
        message=message,
        type=notification_type,
        is_read=is_read,
        read_at=datetime.now(UTC) if is_read else None,
        created_at=created_at or datetime.now(UTC),
    )
    session.add(notification)
    await session.flush()
    return notification
