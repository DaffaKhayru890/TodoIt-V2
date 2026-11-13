from __future__ import annotations

import asyncio
import logging
import signal
import sys
from collections.abc import Callable
from dataclasses import dataclass

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.clock import Clock, utc_now
from app.core.config import settings
from app.core.database import async_session_factory, check_database_connection, engine
from app.core.logging import configure_logging
from app.services.notifications.repository import NotificationRepository
from app.services.notifications.service import NotificationService
from app.services.reminders.repository import ReminderRepository

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class WorkerIterationResult:
    selected: int = 0
    processed: int = 0
    duplicates: int = 0
    cancelled: int = 0
    failed: int = 0


async def process_due_reminders(
    *,
    limit: int | None = None,
    session_factory: async_sessionmaker[AsyncSession] | None = None,
    clock: Clock = utc_now,
) -> WorkerIterationResult:
    """Process one batch of due reminders.

    This is the unit used by the long-running worker and by tests. Each batch
    uses a short-lived database session and transaction. Rows are locked with
    ``FOR UPDATE SKIP LOCKED`` so multiple worker processes can run safely.
    """

    result = WorkerIterationResult()
    if not settings.notification_worker_enabled:
        return result

    batch_size = limit or settings.notification_batch_size
    factory = session_factory or async_session_factory

    async with factory() as session:
        async with session.begin():
            reminders = await ReminderRepository.list_due_for_update(
                session,
                now=clock(),
                limit=batch_size,
            )
            result.selected = len(reminders)

            for reminder in reminders:
                try:
                    async with session.begin_nested():
                        if reminder.status != "pending":
                            continue
                        if reminder.remind_at > clock():
                            continue

                        delivery = await NotificationService.create_notification_for_reminder(
                            session,
                            reminder,
                            clock=clock,
                        )
                        if delivery.created:
                            result.processed += 1
                        elif delivery.notification is not None:
                            result.duplicates += 1
                        elif delivery.cancelled:
                            result.cancelled += 1
                except SQLAlchemyError:
                    # A unique constraint violation can happen if another
                    # worker committed the same reminder between our SELECT and
                    # INSERT. The savepoint is rolled back; reconcile the
                    # reminder with the existing notification if one exists.
                    existing = await NotificationRepository.get_by_reminder_id(
                        session,
                        reminder.id,
                    )
                    if existing is not None:
                        await NotificationService._mark_processed(session, reminder, clock)
                        result.duplicates += 1
                        continue
                    result.failed += 1
                    logger.exception(
                        "notification worker failed to process reminder %s",
                        reminder.id,
                    )
                except Exception:
                    # One malformed record must not stop the whole batch. The
                    # savepoint is rolled back and the reminder stays pending for
                    # a later poll.
                    result.failed += 1
                    logger.exception(
                        "notification worker skipped reminder %s",
                        reminder.id,
                    )

    if result.processed or result.duplicates or result.cancelled or result.failed:
        logger.info(
            "notification worker batch completed selected=%s processed=%s "
            "duplicates=%s cancelled=%s failed=%s",
            result.selected,
            result.processed,
            result.duplicates,
            result.cancelled,
            result.failed,
        )
    return result


async def run_worker(
    stop_event: asyncio.Event | None = None,
    *,
    session_factory: async_sessionmaker[AsyncSession] | None = None,
    clock: Clock = utc_now,
    max_iterations: int | None = None,
) -> None:
    """Run the polling loop until shutdown is requested.

    ``max_iterations`` is primarily useful for operational smoke tests. The
    production process leaves it unset and runs until SIGTERM/SIGINT.
    """

    if not settings.notification_worker_enabled:
        logger.info("notification worker is disabled by configuration")
        return

    stop_event = stop_event or asyncio.Event()
    iterations = 0

    while not stop_event.is_set():
        if max_iterations is not None and iterations >= max_iterations:
            break
        iterations += 1
        try:
            await process_due_reminders(
                session_factory=session_factory,
                clock=clock,
            )
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("notification worker iteration failed; retrying after poll interval")

        if stop_event.is_set():
            break
        try:
            await asyncio.wait_for(
                stop_event.wait(),
                timeout=settings.notification_poll_interval_seconds,
            )
        except TimeoutError:
            continue

    logger.info("notification worker stopped gracefully")


def _install_signal_handlers(stop_event: asyncio.Event) -> Callable[[], None]:
    loop = asyncio.get_running_loop()
    installed: list[signal.Signals] = []

    def _handle_signal(signum: signal.Signals) -> None:
        logger.info("notification worker received signal %s", signum.name)
        stop_event.set()

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, _handle_signal, sig)
            installed.append(sig)
        except (NotImplementedError, RuntimeError):
            logger.debug("signal handler for %s is not supported on this platform", sig.name)

    def _remove_handlers() -> None:
        for sig in installed:
            loop.remove_signal_handler(sig)

    return _remove_handlers


async def main() -> int:
    configure_logging()
    try:
        settings.validate_configuration()
    except ValueError:
        logger.exception("WORKER_CONFIGURATION_INVALID")
        return 2

    if not settings.notification_worker_enabled:
        logger.info("notification worker is disabled by configuration")
        return 0

    stop_event = asyncio.Event()
    remove_handlers = _install_signal_handlers(stop_event)

    try:
        if not await check_database_connection():
            # Do not exit permanently on a transient database outage. The loop
            # retries with the configured poll interval.
            logger.error("WORKER_DATABASE_UNAVAILABLE at startup; worker will retry")
        await run_worker(stop_event)
    finally:
        remove_handlers()
        await engine.dispose()
        logger.info("notification worker database engine disposed")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(asyncio.run(main()))
    except KeyboardInterrupt:  # pragma: no cover - interactive shutdown
        sys.exit(0)
