from __future__ import annotations

import asyncio
from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.services.notifications.models import Notification
from app.services.notifications.worker import process_due_reminders
from app.services.reminders.models import Reminder
from tests.conftest import TEST_DATABASE_URL
from tests.factories import create_reminder, create_todo, create_user, create_workspace


def _new_factory() -> tuple[object, async_sessionmaker[AsyncSession]]:
    """Create an isolated engine so each worker gets its own connection pool."""

    engine = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool)
    factory = async_sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=False,
    )
    return engine, factory


async def _seed_due_reminders(db_session, *, count: int, now) -> list[Reminder]:
    owner = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    reminders: list[Reminder] = []
    for index in range(count):
        todo = await create_todo(
            db_session,
            workspace=workspace,
            creator=owner,
            title=f"Concurrent todo {index}",
        )
        reminders.append(
            await create_reminder(
                db_session,
                todo=todo,
                user=owner,
                remind_at=now - timedelta(minutes=index + 1),
            )
        )
    await db_session.commit()
    return reminders


async def _count(db_session, model) -> int:
    result = await db_session.execute(select(func.count()).select_from(model))
    return int(result.scalar_one())


async def test_concurrent_workers_process_each_reminder_once(
    db_session,
    clock,
    fixed_now,
) -> None:
    reminder_count = 20
    await _seed_due_reminders(db_session, count=reminder_count, now=fixed_now)

    engines_and_factories = [_new_factory() for _ in range(4)]
    try:
        results = await asyncio.gather(
            *[
                process_due_reminders(session_factory=factory, clock=clock)
                for _, factory in engines_and_factories
            ]
        )
    finally:
        for engine, _ in engines_and_factories:
            await engine.dispose()

    processed = sum(result.processed for result in results)
    assert processed == reminder_count
    assert sum(result.failed for result in results) == 0

    assert await _count(db_session, Reminder) == reminder_count
    assert await _count(db_session, Notification) == reminder_count

    statuses = (await db_session.execute(select(Reminder.status))).scalars().all()
    assert statuses == ["processed"] * reminder_count

    reminder_ids = (await db_session.execute(select(Notification.reminder_id))).scalars().all()
    assert len(set(reminder_ids)) == reminder_count
    assert None not in reminder_ids


async def test_skip_locked_skips_rows_locked_by_another_transaction(
    db_session,
    clock,
    fixed_now,
) -> None:
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

    engine, factory = _new_factory()
    try:
        async with factory() as blocking_session:
            async with blocking_session.begin():
                locked = await blocking_session.execute(
                    select(Reminder).where(Reminder.id == reminder.id).with_for_update()
                )
                assert locked.scalar_one().id == reminder.id

                result = await process_due_reminders(
                    session_factory=factory,
                    clock=clock,
                )

                assert result.selected == 0
                assert result.processed == 0

        await db_session.refresh(reminder)
        assert reminder.status == "pending"
        assert await _count(db_session, Notification) == 0

        result = await process_due_reminders(session_factory=factory, clock=clock)

        assert result.processed == 1
        await db_session.refresh(reminder)
        assert reminder.status == "processed"
        assert await _count(db_session, Notification) == 1
    finally:
        await engine.dispose()


async def test_batch_limit_drains_without_losing_reminders(
    db_session,
    clock,
    fixed_now,
) -> None:
    reminder_count = 7
    batch_size = 3
    await _seed_due_reminders(db_session, count=reminder_count, now=fixed_now)

    engine, factory = _new_factory()
    try:
        batches = []
        for _ in range(reminder_count):
            result = await process_due_reminders(
                limit=batch_size,
                session_factory=factory,
                clock=clock,
            )
            batches.append(result)
            if result.selected == 0:
                break
    finally:
        await engine.dispose()

    assert all(result.selected <= batch_size for result in batches)
    assert sum(result.processed for result in batches) == reminder_count
    assert batches[-1].selected == 0
    assert await _count(db_session, Notification) == reminder_count
    assert await _count(db_session, Reminder) == reminder_count


async def test_concurrent_workers_with_small_batches_do_not_lose_work(
    db_session,
    clock,
    fixed_now,
) -> None:
    reminder_count = 12
    await _seed_due_reminders(db_session, count=reminder_count, now=fixed_now)

    engines_and_factories = [_new_factory() for _ in range(3)]

    async def drain(factory: async_sessionmaker[AsyncSession]):
        totals = {"selected": 0, "processed": 0, "failed": 0}
        for _ in range(reminder_count + 1):
            result = await process_due_reminders(
                limit=2,
                session_factory=factory,
                clock=clock,
            )
            totals["selected"] += result.selected
            totals["processed"] += result.processed
            totals["failed"] += result.failed
            if result.selected == 0:
                break
        return totals

    try:
        totals = await asyncio.gather(*[drain(factory) for _, factory in engines_and_factories])
    finally:
        for engine, _ in engines_and_factories:
            await engine.dispose()

    assert sum(item["processed"] for item in totals) == reminder_count
    assert sum(item["failed"] for item in totals) == 0
    assert await _count(db_session, Notification) == reminder_count
