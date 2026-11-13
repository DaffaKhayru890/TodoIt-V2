from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.services.notifications.models import Notification
    from app.services.todos.models import Todo
    from app.services.users.models import User


class Reminder(Base):
    __tablename__ = "reminders"
    __table_args__ = (
        CheckConstraint("status IN ('pending', 'processed', 'cancelled')", name="ck_reminders_status"),
        CheckConstraint("source IN ('manual', 'automatic')", name="ck_reminders_source"),
        Index("ix_reminders_status_remind_at", "status", "remind_at"),
        Index("ix_reminders_user_id", "user_id"),
        Index("ix_reminders_todo_id", "todo_id"),
        Index("ix_reminders_source", "source"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    todo_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("todos.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    source: Mapped[str] = mapped_column(String(32), nullable=False, default="manual")
    remind_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC).replace(microsecond=0),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC).replace(microsecond=0),
        onupdate=lambda: datetime.now(UTC).replace(microsecond=0),
        server_default=func.now(),
    )

    todo: Mapped[Todo] = relationship(back_populates="reminders")
    user: Mapped[User] = relationship(back_populates="reminders")
    notification: Mapped[Notification | None] = relationship(
        back_populates="reminder",
        uselist=False,
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"Reminder(id={self.id!r}, todo_id={self.todo_id!r}, status={self.status!r})"
