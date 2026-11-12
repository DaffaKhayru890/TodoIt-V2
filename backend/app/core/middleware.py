from __future__ import annotations

import uuid
from contextvars import ContextVar

from fastapi import FastAPI, Request
from starlette.responses import Response

_request_id_ctx: ContextVar[str] = ContextVar("request_id", default="")


def get_request_id() -> str:
    value = _request_id_ctx.get()
    return value or "unknown"


async def request_id_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID") or uuid.uuid4().hex
    request.state.request_id = request_id
    token = _request_id_ctx.set(request_id)
    try:
        response: Response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response
    finally:
        _request_id_ctx.reset(token)


def register_middleware(app: FastAPI) -> None:
    app.middleware("http")(request_id_middleware)
