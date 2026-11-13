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
from app.services.labels.routes.labels import router as labels_router
from app.services.tags.routes.tags import router as tags_router
from app.services.todos.routes.todos import router as todos_router
from app.services.users.routes.user_routes import router as user_router
from app.services.workspaces.routes.workspaces import (
    invitation_router,
    legacy_invitation_router,
    legacy_workspace_router,
    workspace_router,
)


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
    app.include_router(workspace_router)
    app.include_router(legacy_workspace_router)
    app.include_router(invitation_router)
    app.include_router(legacy_invitation_router)
    app.include_router(todos_router)
    app.include_router(tags_router)
    app.include_router(labels_router)

    @app.get("/")
    async def root() -> dict:
        return success_response({"service": settings.app_name, "status": "ok"})

    return app


app = create_app()
