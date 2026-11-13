from __future__ import annotations

import base64
import hashlib
import hmac
import json
from typing import Any

CURSOR_VERSION = 1

INVALID_CURSOR = "INVALID_CURSOR"
CURSOR_SIGNATURE_INVALID = "CURSOR_SIGNATURE_INVALID"
CURSOR_VERSION_INVALID = "CURSOR_VERSION_INVALID"


class CursorError(ValueError):
    """Raised when an opaque cursor cannot be decoded or verified."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def encode_cursor(payload: dict[str, Any], *, secret: str) -> str:
    """Encode a signed, URL-safe opaque cursor.

    The payload must already contain ``version`` and any binding fields the
    caller wants to enforce (for example a user id and filter fingerprint).
    """

    raw = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    digest = hmac.new(secret.encode("utf-8"), raw, hashlib.sha256).digest()
    encoded_payload = base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")
    encoded_signature = base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")
    return f"{encoded_payload}.{encoded_signature}"


def decode_cursor(cursor: str, *, secret: str) -> dict[str, Any]:
    """Decode and verify a signed cursor, raising ``CursorError`` on failure."""

    if not cursor or "." not in cursor:
        raise CursorError(INVALID_CURSOR)

    payload_b64, signature_b64 = cursor.split(".", 1)
    try:
        raw_payload = base64.urlsafe_b64decode(payload_b64 + "=" * (-len(payload_b64) % 4))
        expected_signature = base64.urlsafe_b64decode(
            signature_b64 + "=" * (-len(signature_b64) % 4)
        )
    except Exception as exc:
        raise CursorError(INVALID_CURSOR) from exc

    digest = hmac.new(secret.encode("utf-8"), raw_payload, hashlib.sha256).digest()
    if not hmac.compare_digest(digest, expected_signature):
        raise CursorError(CURSOR_SIGNATURE_INVALID)

    try:
        payload = json.loads(raw_payload.decode("utf-8"))
    except Exception as exc:
        raise CursorError(INVALID_CURSOR) from exc

    if not isinstance(payload, dict):
        raise CursorError(INVALID_CURSOR)
    if payload.get("version") != CURSOR_VERSION:
        raise CursorError(CURSOR_VERSION_INVALID)
    return payload
