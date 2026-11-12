from __future__ import annotations

from typing import Any


def success_response(data: Any | None = None, message: str = "success") -> dict[str, Any]:
    payload: dict[str, Any] = {"success": True, "message": message}
    if data is not None:
        payload["data"] = data
    return payload


def error_response(code: str, message: str, *, request_id: str | None = None) -> dict[str, Any]:
    payload: dict[str, Any] = {"success": False, "error": {"code": code, "message": message}}
    if request_id is not None:
        payload["error"]["request_id"] = request_id
    return payload
