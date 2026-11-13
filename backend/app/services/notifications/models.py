from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.services.reminders.models import Reminder
    from app.services.todos.models import Todo
    from app.services.users.models import User


class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = (
        CheckConstraint(
            "type IN ('todo_reminder', 'due_date_reminder')",
            name="ck_notifications_type",
        ),
        CheckConstraint(
            "(is_read = false AND read_at IS NULL) OR (is_read = true AND read_at IS NOT NULL)",
            name="ck_notifications_read_consistency",
        ),
        UniqueConstraint("reminder_id", name="uq_notifications_reminder_id"),
        Index("ix_notifications_user_id", "user_id"),
        Index("ix_notifications_todo_id", "todo_id"),
        Index("ix_notifications_reminder_id", "reminder_id"),
        Index("ix_notifications_is_read", "is_read"),
        Index("ix_notifications_user_created_at", "user_id", "created_at"),
        Index("ix_notifications_user_created_id", "user_id", "created_at", "id"),
        Index("ix_notifications_user_unread", "user_id", "is_read"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    todo_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("todos.id", ondelete="SET NULL"),
        nullable=True,
    )
    reminder_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("reminders.id", ondelete="SET NULL"),
        nullable=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    type: Mapped[str] = mapped_column(String(32), nullable=False, default="todo_reminder")
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC).replace(microsecond=0),
        server_default=func.now(),
    )

    user: Mapped[User] = relationship(back_populates="notifications")
    todo: Mapped[Todo | None] = relationship(back_populates="notifications")
    reminder: Mapped[Reminder | None] = relationship(back_populates="notification")

    def __repr__(self) -> str:
        return f"Notification(id={self.id!r}, user_id={self.user_id!r}, type={self.type!r})"
