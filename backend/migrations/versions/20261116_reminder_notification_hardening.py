from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20261116_reminder_notification_hardening"
down_revision = "20261115_add_reminders_and_notifications"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_check_constraint(
        "ck_reminders_processed_at_consistency",
        "reminders",
        "(status = 'processed' AND processed_at IS NOT NULL) "
        "OR (status <> 'processed' AND processed_at IS NULL)",
    )
    op.create_index(
        "uq_reminders_automatic_pending",
        "reminders",
        ["todo_id", "user_id"],
        unique=True,
        postgresql_where=sa.text("source = 'automatic' AND status = 'pending'"),
    )
    op.create_index(
        "uq_reminders_manual_pending_time",
        "reminders",
        ["todo_id", "user_id", "remind_at"],
        unique=True,
        postgresql_where=sa.text("source = 'manual' AND status = 'pending'"),
    )

    op.create_check_constraint(
        "ck_notifications_read_consistency",
        "notifications",
        "(is_read = false AND read_at IS NULL) OR (is_read = true AND read_at IS NOT NULL)",
    )
    op.create_index(
        "ix_notifications_user_created_id",
        "notifications",
        ["user_id", "created_at", "id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_notifications_user_created_id", table_name="notifications")
    op.drop_constraint(
        "ck_notifications_read_consistency",
        "notifications",
        type_="check",
    )

    op.drop_index("uq_reminders_manual_pending_time", table_name="reminders")
    op.drop_index("uq_reminders_automatic_pending", table_name="reminders")
    op.drop_constraint(
        "ck_reminders_processed_at_consistency",
        "reminders",
        type_="check",
    )
