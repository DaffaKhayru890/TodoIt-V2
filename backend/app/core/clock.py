from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, datetime

Clock = Callable[[], datetime]


def utc_now() -> datetime:
    """Return the current timezone-aware UTC timestamp.

    Services accept a ``Clock`` callable so reminder scheduling and worker
    processing can be tested deterministically without sleeping.
    """

    return datetime.now(UTC)


def ensure_utc(value: datetime) -> datetime:
    """Normalize an aware datetime to UTC.

    Naive datetimes are rejected because all persisted timestamps in the
    application are timezone-aware and stored in UTC.
    """

    if value.tzinfo is None:
        raise ValueError("datetime must be timezone-aware")
    return value.astimezone(UTC)
