from __future__ import annotations

from fastapi import APIRouter

from app.common.response import success_response
from app.core.database import check_database_connection
from app.core.middleware import get_request_id

router = APIRouter(tags=["Health"])


@router.get("/health/live")
async def live() -> dict:
    return success_response({"status": "alive"}, message="service is live")


@router.get("/health/ready")
async def ready() -> dict:
    is_ready = await check_database_connection()
    if not is_ready:
        return {
            "success": False,
            "error": {
                "code": "database_unavailable",
                "message": "Database is unavailable",
                "request_id": get_request_id(),
            },
        }
    return success_response({"status": "ready"}, message="service is ready")
