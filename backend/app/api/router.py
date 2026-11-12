from __future__ import annotations

from fastapi import APIRouter

from app.common.response import success_response
from app.core.config import settings

router = APIRouter(prefix=settings.api_v1_prefix)


@router.get("/status")
async def app_status() -> dict:
    return success_response({"environment": settings.app_env, "service": settings.app_name})
