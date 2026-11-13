from __future__ import annotations

from app.services.workspaces.routes.workspaces import (
    invitation_router,
    legacy_invitation_router,
    legacy_workspace_router,
    workspace_router,
)

__all__ = [
    "workspace_router",
    "legacy_workspace_router",
    "invitation_router",
    "legacy_invitation_router",
]
