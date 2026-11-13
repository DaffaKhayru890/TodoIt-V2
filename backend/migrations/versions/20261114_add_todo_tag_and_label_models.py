from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "20261114_add_todo_tag_and_label_models"
down_revision = "20261113_add_workspace_models"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "todos",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="todo"),
        sa.Column("priority", sa.String(length=32), nullable=False, server_default="medium"),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
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
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="CASCADE"),
        sa.CheckConstraint("status IN ('todo', 'in_progress', 'completed')", name="ck_todos_status"),
        sa.CheckConstraint(
            "priority IN ('low', 'medium', 'high', 'urgent')",
            name="ck_todos_priority",
        ),
    )
    op.create_index(op.f("ix_todos_workspace_id"), "todos", ["workspace_id"], unique=False)
    op.create_index(op.f("ix_todos_created_by"), "todos", ["created_by"], unique=False)
    op.create_index(op.f("ix_todos_status"), "todos", ["status"], unique=False)
    op.create_index(op.f("ix_todos_priority"), "todos", ["priority"], unique=False)
    op.create_index(op.f("ix_todos_due_at"), "todos", ["due_at"], unique=False)
    op.create_index(op.f("ix_todos_created_at"), "todos", ["created_at"], unique=False)

    op.create_table(
        "tags",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
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
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("workspace_id", "name", name="uq_tags_workspace_name"),
    )
    op.create_index(op.f("ix_tags_workspace_id"), "tags", ["workspace_id"], unique=False)

    op.create_table(
        "labels",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("color", sa.String(length=16), nullable=False, server_default="#6B7280"),
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
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("workspace_id", "name", name="uq_labels_workspace_name"),
        sa.CheckConstraint("color ~ '^#[0-9A-Fa-f]{6}$'", name="ck_labels_color_hex"),
    )
    op.create_index(op.f("ix_labels_workspace_id"), "labels", ["workspace_id"], unique=False)

    op.create_table(
        "todo_tags",
        sa.Column("todo_id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("tag_id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.ForeignKeyConstraint(["todo_id"], ["todos.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tag_id"], ["tags.id"], ondelete="CASCADE"),
    )
    op.create_index(op.f("ix_todo_tags_todo_id"), "todo_tags", ["todo_id"], unique=False)
    op.create_index(op.f("ix_todo_tags_tag_id"), "todo_tags", ["tag_id"], unique=False)

    op.create_table(
        "todo_labels",
        sa.Column("todo_id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("label_id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.ForeignKeyConstraint(["todo_id"], ["todos.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["label_id"], ["labels.id"], ondelete="CASCADE"),
    )
    op.create_index(op.f("ix_todo_labels_todo_id"), "todo_labels", ["todo_id"], unique=False)
    op.create_index(op.f("ix_todo_labels_label_id"), "todo_labels", ["label_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_todo_labels_label_id"), table_name="todo_labels")
    op.drop_index(op.f("ix_todo_labels_todo_id"), table_name="todo_labels")
    op.drop_table("todo_labels")

    op.drop_index(op.f("ix_todo_tags_tag_id"), table_name="todo_tags")
    op.drop_index(op.f("ix_todo_tags_todo_id"), table_name="todo_tags")
    op.drop_table("todo_tags")

    op.drop_index(op.f("ix_labels_workspace_id"), table_name="labels")
    op.drop_table("labels")

    op.drop_index(op.f("ix_tags_workspace_id"), table_name="tags")
    op.drop_table("tags")

    op.drop_index(op.f("ix_todos_created_at"), table_name="todos")
    op.drop_index(op.f("ix_todos_due_at"), table_name="todos")
    op.drop_index(op.f("ix_todos_priority"), table_name="todos")
    op.drop_index(op.f("ix_todos_status"), table_name="todos")
    op.drop_index(op.f("ix_todos_created_by"), table_name="todos")
    op.drop_index(op.f("ix_todos_workspace_id"), table_name="todos")
    op.drop_table("todos")
