from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db_session
from app.services.auth.dependencies import get_current_user
from app.services.auth.schemas import (
    LoginRequest,
    RefreshResponse,
    RegisterRequest,
    TokenResponse,
)
from app.services.auth.service import AuthService
from app.services.users.models import User
from app.services.users.schemas import UserResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _cookie_kwargs() -> dict[str, Any]:
    return {
        "httponly": settings.refresh_cookie_httponly,
        "secure": settings.refresh_cookie_secure,
        "samesite": settings.refresh_cookie_samesite,
        "path": settings.refresh_cookie_path,
        "domain": settings.refresh_cookie_domain,
        "max_age": settings.jwt_refresh_token_expire_days * 24 * 60 * 60,
    }


def _csrf_cookie_kwargs() -> dict[str, Any]:
    return {
        "httponly": settings.csrf_cookie_httponly,
        "secure": settings.csrf_cookie_secure,
        "samesite": settings.csrf_cookie_samesite,
        "path": "/",
        "max_age": settings.jwt_refresh_token_expire_days * 24 * 60 * 60,
    }


@router.post(
    "/register",
    status_code=status.HTTP_201_CREATED,
    response_model=UserResponse,
    summary="Create a new user",
    description="Register a new user account.",
)
async def register_user(
    payload: RegisterRequest,
    session: AsyncSession = Depends(get_db_session),
) -> User:
    return await AuthService.register(
        session,
        email=payload.email,
        password=payload.password,
        full_name=payload.full_name,
        timezone=payload.timezone,
    )


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Authenticate a user and issue a token pair",
    description="Validates the supplied credentials and returns an access token.",
)
async def login(
    payload: LoginRequest,
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    access_token, refresh_token, csrf_token, user = await AuthService.login(
        session,
        email=payload.email,
        password=payload.password,
    )
    body = {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": settings.jwt_access_token_expire_minutes * 60,
        "user": {
            "id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
            "timezone": user.timezone,
            "is_active": user.is_active,
            "created_at": user.created_at.isoformat(),
            "updated_at": user.updated_at.isoformat(),
        },
    }
    response = Response(content=json.dumps(body), media_type="application/json")
    response.set_cookie(
        key=settings.refresh_cookie_name,
        value=refresh_token,
        **_cookie_kwargs(),
    )
    response.set_cookie(
        key=settings.csrf_cookie_name,
        value=csrf_token,
        **_csrf_cookie_kwargs(),
    )
    return response


@router.post(
    "/refresh",
    response_model=RefreshResponse,
    summary="Rotate the refresh token",
    description="Validates the refresh cookie and CSRF token, then issues a new access token.",
)
async def refresh_token(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    refresh_cookie = request.cookies.get(settings.refresh_cookie_name)
    csrf_token = request.headers.get(settings.csrf_header_name)
    if not refresh_cookie:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )
    access_token, new_refresh_token, _ = await AuthService.refresh(
        session,
        refresh_token=refresh_cookie,
        csrf_token=csrf_token,
        request=request,
    )
    body = {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": settings.jwt_access_token_expire_minutes * 60,
    }
    response = Response(content=json.dumps(body), media_type="application/json")
    response.set_cookie(
        key=settings.refresh_cookie_name,
        value=new_refresh_token,
        **_cookie_kwargs(),
    )
    response.set_cookie(
        key=settings.csrf_cookie_name,
        value=csrf_token or "",
        **_csrf_cookie_kwargs(),
    )
    return response


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Revoke the current refresh session",
    description="Revokes the currently bound refresh session and clears auth cookies.",
)
async def logout(
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    refresh_cookie = request.cookies.get(settings.refresh_cookie_name)
    if refresh_cookie:
        await AuthService.logout(session, refresh_token=refresh_cookie)
    response.delete_cookie(
        key=settings.refresh_cookie_name,
        path=settings.refresh_cookie_path,
        domain=settings.refresh_cookie_domain,
        samesite=settings.refresh_cookie_samesite,
    )
    response.delete_cookie(
        key=settings.csrf_cookie_name,
        path="/",
        samesite=settings.csrf_cookie_samesite,
    )
    await session.commit()


@router.post(
    "/logout-all",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Revoke all active sessions for the current user",
    description="Revokes every refresh session for the authenticated user.",
)
async def logout_all(
    response: Response,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> None:
    await AuthService.logout_all(session, user_id=current_user.id)
    response.delete_cookie(
        key=settings.refresh_cookie_name,
        path=settings.refresh_cookie_path,
        domain=settings.refresh_cookie_domain,
        samesite=settings.refresh_cookie_samesite,
    )
    response.delete_cookie(
        key=settings.csrf_cookie_name,
        path="/",
        samesite=settings.csrf_cookie_samesite,
    )


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get the current user profile",
    description="Returns the currently authenticated user.",
)
async def get_me(current_user: User = Depends(get_current_user)) -> User:
    return current_user
