from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "20261115_add_reminders_and_notifications"
down_revision = "20261114_add_todo_tag_and_label_models"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "reminders",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("todo_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source", sa.String(length=32), nullable=False, server_default="manual"),
        sa.Column("remind_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="pending"),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.ForeignKeyConstraint(["todo_id"], ["todos.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.CheckConstraint("source IN ('manual', 'automatic')", name="ck_reminders_source"),
        sa.CheckConstraint("status IN ('pending', 'processed', 'cancelled')", name="ck_reminders_status"),
    )
    op.create_index(op.f("ix_reminders_todo_id"), "reminders", ["todo_id"], unique=False)
    op.create_index(op.f("ix_reminders_user_id"), "reminders", ["user_id"], unique=False)
    op.create_index(op.f("ix_reminders_source"), "reminders", ["source"], unique=False)
    op.create_index(op.f("ix_reminders_remind_at"), "reminders", ["remind_at"], unique=False)
    op.create_index(op.f("ix_reminders_status"), "reminders", ["status"], unique=False)
    op.create_index(
        "ix_reminders_status_remind_at",
        "reminders",
        ["status", "remind_at"],
        unique=False,
    )

    op.create_table(
        "notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("todo_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("reminder_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("type", sa.String(length=32), nullable=False, server_default="todo_reminder"),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["todo_id"], ["todos.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["reminder_id"], ["reminders.id"], ondelete="SET NULL"),
        sa.CheckConstraint(
            "type IN ('todo_reminder', 'due_date_reminder')",
            name="ck_notifications_type",
        ),
        sa.UniqueConstraint("reminder_id", name="uq_notifications_reminder_id"),
    )
    op.create_index(op.f("ix_notifications_user_id"), "notifications", ["user_id"], unique=False)
    op.create_index(op.f("ix_notifications_todo_id"), "notifications", ["todo_id"], unique=False)
    op.create_index(op.f("ix_notifications_reminder_id"), "notifications", ["reminder_id"], unique=False)
    op.create_index(op.f("ix_notifications_is_read"), "notifications", ["is_read"], unique=False)
    op.create_index(
        "ix_notifications_user_created_at",
        "notifications",
        ["user_id", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_notifications_user_unread",
        "notifications",
        ["user_id", "is_read"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_notifications_user_unread", table_name="notifications")
    op.drop_index("ix_notifications_user_created_at", table_name="notifications")
    op.drop_index(op.f("ix_notifications_is_read"), table_name="notifications")
    op.drop_index(op.f("ix_notifications_reminder_id"), table_name="notifications")
    op.drop_index(op.f("ix_notifications_todo_id"), table_name="notifications")
    op.drop_index(op.f("ix_notifications_user_id"), table_name="notifications")
    op.drop_table("notifications")

    op.drop_index("ix_reminders_status_remind_at", table_name="reminders")
    op.drop_index(op.f("ix_reminders_status"), table_name="reminders")
    op.drop_index(op.f("ix_reminders_remind_at"), table_name="reminders")
    op.drop_index(op.f("ix_reminders_source"), table_name="reminders")
    op.drop_index(op.f("ix_reminders_user_id"), table_name="reminders")
    op.drop_index(op.f("ix_reminders_todo_id"), table_name="reminders")
    op.drop_table("reminders")
