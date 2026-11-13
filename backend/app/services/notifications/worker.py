from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime

from app.core.config import settings
from app.core.database import async_session_factory
from app.services.notifications.service import NotificationService
from app.services.reminders.models import Reminder
from app.services.reminders.service import ReminderService

logger = logging.getLogger(__name__)


async def process_due_reminders(limit: int | None = None) -> int:
    if not settings.notification_worker_enabled:
        return 0

    limit = limit or settings.notification_batch_size
    processed = 0
    async with async_session_factory() as session:
        due_reminders = await ReminderService.list_due_reminders(session, limit)
        for reminder in due_reminders:
            try:
                async with session.begin():
                    fresh = await session.get(Reminder, reminder.id)
                    if fresh is None or fresh.status != "pending":
                        continue
                    if fresh.remind_at > datetime.now(UTC):
                        continue
                    await NotificationService.create_notification_for_reminder(session, fresh)
                    processed += 1
            except Exception as exc:  # pragma: no cover - defensive worker handling
                logger.exception("notification worker failed for reminder %s: %s", reminder.id, exc)
                await session.rollback()
    return processed


async def run_worker(stop_event: asyncio.Event | None = None) -> None:
    if not settings.notification_worker_enabled:
        return

    stop_event = stop_event or asyncio.Event()

    def _handle_signal() -> None:
        stop_event.set()

    loop = asyncio.get_running_loop()
    for sig in ("SIGINT", "SIGTERM"):
        try:
            loop.add_signal_handler(getattr(__import__("signal"), sig), _handle_signal)
        except (AttributeError, NotImplementedError):
            pass

    while not stop_event.is_set():
        await process_due_reminders(settings.notification_batch_size)
        await asyncio.sleep(settings.notification_poll_interval_seconds)


async def main() -> None:
    stop_event = asyncio.Event()
    await run_worker(stop_event)


if __name__ == "__main__":
    asyncio.run(main())
