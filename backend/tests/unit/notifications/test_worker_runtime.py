from __future__ import annotations

import asyncio
import os
import signal
from datetime import timedelta

import pytest
from sqlalchemy.exc import IntegrityError

from app.core.config import settings
from app.services.notifications import worker as worker_module
from app.services.notifications.worker import (
    _install_signal_handlers,
    main,
    process_due_reminders,
    run_worker,
)
from app.services.reminders.models import Reminder
from app.services.reminders.repository import ReminderRepository
from tests.factories import (
    create_notification,
    create_reminder,
    create_todo,
    create_user,
    create_workspace,
)


async def _due_reminder(db_session, fixed_now) -> Reminder:
    owner = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    todo = await create_todo(db_session, workspace=workspace, creator=owner)
    reminder = await create_reminder(
        db_session,
        todo=todo,
        user=owner,
        remind_at=fixed_now - timedelta(minutes=1),
    )
    await db_session.commit()
    return reminder


def _integrity_error() -> IntegrityError:
    return IntegrityError("INSERT INTO notifications", {}, Exception("duplicate key"))


async def test_worker_skips_non_pending_rows_returned_by_selection(
    session_factory,
    db_session,
    clock,
    fixed_now,
    monkeypatch,
) -> None:
    reminder = await _due_reminder(db_session, fixed_now)
    reminder.status = "cancelled"
    await db_session.commit()

    async def selection(*args, **kwargs):
        return [reminder]

    monkeypatch.setattr(
        ReminderRepository,
        "list_due_for_update",
        staticmethod(selection),
    )

    result = await process_due_reminders(session_factory=session_factory, clock=clock)

    assert result.selected == 1
    assert result.processed == 0
    assert result.cancelled == 0
    assert result.failed == 0


async def test_worker_skips_rows_moved_into_the_future(
    session_factory,
    db_session,
    clock,
    fixed_now,
    monkeypatch,
) -> None:
    reminder = await _due_reminder(db_session, fixed_now)
    reminder.remind_at = fixed_now + timedelta(minutes=5)
    await db_session.commit()

    async def selection(*args, **kwargs):
        return [reminder]

    monkeypatch.setattr(
        ReminderRepository,
        "list_due_for_update",
        staticmethod(selection),
    )

    result = await process_due_reminders(session_factory=session_factory, clock=clock)

    assert result.selected == 1
    assert result.processed == 0
    await db_session.refresh(reminder)
    assert reminder.status == "pending"


async def test_worker_continues_after_skipping_a_row(
    session_factory,
    db_session,
    clock,
    fixed_now,
    monkeypatch,
) -> None:
    skipped = await _due_reminder(db_session, fixed_now)
    skipped.status = "cancelled"
    await db_session.commit()

    owner = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    todo = await create_todo(db_session, workspace=workspace, creator=owner)
    deliverable = await create_reminder(
        db_session,
        todo=todo,
        user=owner,
        remind_at=fixed_now - timedelta(minutes=2),
    )
    await db_session.commit()

    async def selection(*args, **kwargs):
        return [skipped, deliverable]

    monkeypatch.setattr(
        ReminderRepository,
        "list_due_for_update",
        staticmethod(selection),
    )

    result = await process_due_reminders(session_factory=session_factory, clock=clock)

    assert result.selected == 2
    assert result.processed == 1
    assert result.failed == 0


async def test_integrity_error_with_existing_notification_is_reconciled(
    session_factory,
    db_session,
    clock,
    fixed_now,
    monkeypatch,
) -> None:
    reminder = await _due_reminder(db_session, fixed_now)
    owner = await create_user(db_session)
    existing = await create_notification(
        db_session,
        user=owner,
        todo=None,
        reminder=reminder,
    )
    await db_session.commit()

    async def conflict(*args, **kwargs):
        raise _integrity_error()

    monkeypatch.setattr(
        worker_module.NotificationService,
        "create_notification_for_reminder",
        staticmethod(conflict),
    )

    result = await process_due_reminders(session_factory=session_factory, clock=clock)

    assert result.duplicates == 1
    assert result.failed == 0
    await db_session.refresh(reminder)
    assert reminder.status == "processed"
    assert existing.id is not None


async def test_integrity_error_without_existing_notification_counts_failure(
    session_factory,
    db_session,
    clock,
    fixed_now,
    monkeypatch,
) -> None:
    reminder = await _due_reminder(db_session, fixed_now)

    async def conflict(*args, **kwargs):
        raise _integrity_error()

    monkeypatch.setattr(
        worker_module.NotificationService,
        "create_notification_for_reminder",
        staticmethod(conflict),
    )

    result = await process_due_reminders(session_factory=session_factory, clock=clock)

    assert result.failed == 1
    assert result.duplicates == 0
    await db_session.refresh(reminder)
    assert reminder.status == "pending"


async def test_run_worker_stops_after_requested_iterations(
    session_factory,
    clock,
    monkeypatch,
) -> None:
    calls = {"count": 0}

    async def fake_batch(*args, **kwargs):
        calls["count"] += 1
        return worker_module.WorkerIterationResult()

    monkeypatch.setattr(worker_module, "process_due_reminders", fake_batch)
    monkeypatch.setattr(settings, "notification_poll_interval_seconds", 0.01)

    await run_worker(
        session_factory=session_factory,
        clock=clock,
        max_iterations=3,
    )

    assert calls["count"] == 3


async def test_run_worker_exits_when_disabled(
    session_factory,
    clock,
    monkeypatch,
) -> None:
    async def unexpected(*args, **kwargs):  # pragma: no cover - must not run
        raise AssertionError("worker should not poll when disabled")

    monkeypatch.setattr(worker_module, "process_due_reminders", unexpected)
    monkeypatch.setattr(settings, "notification_worker_enabled", False)

    await run_worker(session_factory=session_factory, clock=clock, max_iterations=1)


async def test_run_worker_survives_iteration_errors(
    session_factory,
    clock,
    monkeypatch,
) -> None:
    calls = {"count": 0}

    async def flaky(*args, **kwargs):
        calls["count"] += 1
        if calls["count"] == 1:
            raise RuntimeError("transient failure")
        return worker_module.WorkerIterationResult()

    monkeypatch.setattr(worker_module, "process_due_reminders", flaky)
    monkeypatch.setattr(settings, "notification_poll_interval_seconds", 0.01)

    await run_worker(
        session_factory=session_factory,
        clock=clock,
        max_iterations=2,
    )

    assert calls["count"] == 2


async def test_signal_handler_sets_stop_event(monkeypatch) -> None:
    stop_event = asyncio.Event()
    remove_handlers = _install_signal_handlers(stop_event)
    try:
        os.kill(os.getpid(), signal.SIGTERM)
        await asyncio.sleep(0.05)
    finally:
        remove_handlers()

    assert stop_event.is_set()


async def test_main_returns_zero_when_worker_disabled(monkeypatch) -> None:
    monkeypatch.setattr(settings, "notification_worker_enabled", False)
    monkeypatch.setattr(worker_module, "configure_logging", lambda: None)

    assert await main() == 0


class _FakeEngine:
    def __init__(self) -> None:
        self.disposed = False

    async def dispose(self) -> None:
        self.disposed = True


async def test_main_runs_worker_and_disposes_engine(monkeypatch) -> None:
    fake_engine = _FakeEngine()

    async def fake_check() -> bool:
        return True

    async def fake_run(*args, **kwargs) -> None:
        return None

    monkeypatch.setattr(worker_module, "check_database_connection", fake_check)
    monkeypatch.setattr(worker_module, "run_worker", fake_run)
    monkeypatch.setattr(worker_module, "engine", fake_engine)
    monkeypatch.setattr(worker_module, "configure_logging", lambda: None)

    assert await main() == 0
    assert fake_engine.disposed is True


async def test_main_retries_when_database_is_unavailable(monkeypatch) -> None:
    ran = {"value": False}
    fake_engine = _FakeEngine()

    async def fake_check() -> bool:
        return False

    async def fake_run(*args, **kwargs) -> None:
        ran["value"] = True

    monkeypatch.setattr(worker_module, "check_database_connection", fake_check)
    monkeypatch.setattr(worker_module, "run_worker", fake_run)
    monkeypatch.setattr(worker_module, "engine", fake_engine)
    monkeypatch.setattr(worker_module, "configure_logging", lambda: None)

    assert await main() == 0
    assert ran["value"] is True
    assert fake_engine.disposed is True


async def test_main_rejects_invalid_configuration(monkeypatch) -> None:
    def invalid(self) -> None:
        raise ValueError("bad configuration")

    monkeypatch.setattr(type(settings), "validate_configuration", invalid)
    monkeypatch.setattr(worker_module, "configure_logging", lambda: None)

    assert await main() == 2


async def test_worker_does_not_process_after_disabled_mid_run(
    session_factory,
    clock,
    monkeypatch,
) -> None:
    monkeypatch.setattr(settings, "notification_worker_enabled", False)

    result = await process_due_reminders(session_factory=session_factory, clock=clock)

    assert result.selected == 0


@pytest.mark.parametrize("status", ["processed", "cancelled"])
async def test_selection_only_returns_pending(
    session_factory,
    db_session,
    clock,
    fixed_now,
    status,
) -> None:
    owner = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    todo = await create_todo(db_session, workspace=workspace, creator=owner)
    await create_reminder(
        db_session,
        todo=todo,
        user=owner,
        status=status,
        remind_at=fixed_now - timedelta(minutes=1),
    )
    await db_session.commit()

    result = await process_due_reminders(session_factory=session_factory, clock=clock)

    assert result.selected == 0
    assert result.processed == 0
