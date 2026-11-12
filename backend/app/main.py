from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.health import router as health_router
from app.api.router import router as api_router
from app.common.response import success_response
from app.core.config import settings
from app.core.exceptions import register_exception_handlers
from app.core.logging import configure_logging
from app.core.middleware import register_middleware
from app.services.auth.routes.auth_routes import router as auth_router
from app.services.users.routes.user_routes import router as user_router


def create_app() -> FastAPI:
    configure_logging()
    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        debug=settings.app_debug,
        openapi_url="/openapi.json" if settings.openapi_enabled else None,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=settings.cors_allow_credentials,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    register_middleware(app)
    register_exception_handlers(app)

    app.include_router(health_router)
    app.include_router(api_router)
    app.include_router(auth_router)
    app.include_router(user_router)

    @app.get("/")
    async def root() -> dict:
        return success_response({"service": settings.app_name, "status": "ok"})

    return app


app = create_app()
