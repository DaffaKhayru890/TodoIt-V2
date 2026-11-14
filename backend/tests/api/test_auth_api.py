from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.services.auth.models import RefreshSession
from app.services.auth.security import create_jwt_token
from tests.conftest import authenticate
from tests.factories import create_user

PASSWORD = "secure-password-123"


async def _register(api_client, email: str = "person@example.com"):
    return await api_client.post(
        "/auth/register",
        json={
            "email": email,
            "password": PASSWORD,
            "full_name": "Person Example",
            "timezone": "UTC",
        },
    )


async def _login(api_client, email: str = "person@example.com"):
    return await api_client.post(
        "/auth/login",
        json={"email": email, "password": PASSWORD},
    )


async def test_register_creates_user(api_client, db_session) -> None:
    response = await _register(api_client)

    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "person@example.com"
    assert body["full_name"] == "Person Example"
    assert body["timezone"] == "UTC"
    assert body["is_active"] is True


async def test_register_normalizes_email_and_rejects_duplicate(api_client) -> None:
    first = await _register(api_client, "Person@Example.com")
    second = await _register(api_client, "person@example.com")

    assert first.status_code == 201
    assert first.json()["email"] == "person@example.com"
    assert second.status_code == 409
    assert second.json()["detail"] == "EMAIL_ALREADY_REGISTERED"


async def test_register_rejects_invalid_payload(api_client) -> None:
    bad_email = await api_client.post(
        "/auth/register",
        json={"email": "not-an-email", "password": PASSWORD, "full_name": "X"},
    )
    short_password = await api_client.post(
        "/auth/register",
        json={"email": "x@example.com", "password": "short", "full_name": "X"},
    )
    blank_name = await api_client.post(
        "/auth/register",
        json={"email": "y@example.com", "password": PASSWORD, "full_name": ""},
    )

    assert bad_email.status_code == 422
    assert short_password.status_code == 422
    assert blank_name.status_code == 422


async def test_login_success_sets_cookies_and_returns_token(api_client) -> None:
    await _register(api_client)

    response = await _login(api_client)

    assert response.status_code == 200
    body = response.json()
    assert body["access_token"].startswith("eyJ")
    assert body["token_type"] == "bearer"
    assert body["user"]["email"] == "person@example.com"
    assert api_client.cookies.get("refresh_token")
    assert api_client.cookies.get("csrf_token")


async def test_login_rejects_bad_credentials_and_inactive_user(
    api_client,
    db_session,
) -> None:
    await _register(api_client)

    wrong_password = await api_client.post(
        "/auth/login",
        json={"email": "person@example.com", "password": "wrong-password-123"},
    )
    unknown = await api_client.post(
        "/auth/login",
        json={"email": "missing@example.com", "password": PASSWORD},
    )
    inactive = await create_user(
        db_session,
        email="inactive@example.com",
        is_active=False,
    )
    await db_session.commit()
    inactive_response = await api_client.post(
        "/auth/login",
        json={"email": inactive.email, "password": PASSWORD},
    )

    assert wrong_password.status_code == 401
    assert unknown.status_code == 401
    assert inactive_response.status_code == 403
    assert inactive_response.json()["detail"] == "User inactive"


async def test_refresh_rotates_token(api_client) -> None:
    await _register(api_client)
    login = await _login(api_client)
    old_refresh = login.cookies["refresh_token"]
    csrf = login.cookies["csrf_token"]

    response = await api_client.post(
        "/auth/refresh",
        headers={"X-CSRF-Token": csrf},
        cookies={"refresh_token": old_refresh, "csrf_token": csrf},
    )

    assert response.status_code == 200
    assert response.json()["access_token"].startswith("eyJ")
    assert response.cookies["refresh_token"] != old_refresh


async def test_refresh_requires_cookie_and_csrf(api_client) -> None:
    await _register(api_client)
    login = await _login(api_client)
    refresh = login.cookies["refresh_token"]
    csrf = login.cookies["csrf_token"]

    no_cookie = await api_client.post(
        "/auth/refresh",
        headers={"X-CSRF-Token": csrf},
        cookies={"csrf_token": csrf},
    )
    no_header = await api_client.post(
        "/auth/refresh",
        cookies={"refresh_token": refresh, "csrf_token": csrf},
    )
    wrong_header = await api_client.post(
        "/auth/refresh",
        headers={"X-CSRF-Token": "wrong"},
        cookies={"refresh_token": refresh, "csrf_token": csrf},
    )

    assert no_cookie.status_code == 401
    assert no_header.status_code == 403
    assert wrong_header.status_code == 403


async def test_refresh_rejects_invalid_and_wrong_token_type(api_client) -> None:
    await _register(api_client)
    login = await _login(api_client)
    csrf = login.cookies["csrf_token"]
    access_token = login.json()["access_token"]

    invalid = await api_client.post(
        "/auth/refresh",
        headers={"X-CSRF-Token": csrf},
        cookies={"refresh_token": "not-a-token", "csrf_token": csrf},
    )
    wrong_type = await api_client.post(
        "/auth/refresh",
        headers={"X-CSRF-Token": csrf},
        cookies={"refresh_token": access_token, "csrf_token": csrf},
    )

    assert invalid.status_code == 401
    assert wrong_type.status_code == 401


async def test_refresh_replay_revokes_session(api_client, db_session) -> None:
    await _register(api_client)
    login = await _login(api_client)
    old_refresh = login.cookies["refresh_token"]
    csrf = login.cookies["csrf_token"]

    first = await api_client.post(
        "/auth/refresh",
        headers={"X-CSRF-Token": csrf},
        cookies={"refresh_token": old_refresh, "csrf_token": csrf},
    )
    replay = await api_client.post(
        "/auth/refresh",
        headers={"X-CSRF-Token": csrf},
        cookies={"refresh_token": old_refresh, "csrf_token": csrf},
    )

    assert first.status_code == 200
    assert replay.status_code == 401
    assert replay.json()["detail"] == "REFRESH_TOKEN_REPLAYED"

    result = await db_session.execute(select(RefreshSession))
    assert all(session.revoked_at is not None for session in result.scalars().all())


async def test_refresh_rejects_unknown_session(api_client, db_session) -> None:
    user = await create_user(db_session, email="session@example.com")
    await db_session.commit()
    token = create_jwt_token(
        str(user.id),
        session_id="00000000-0000-0000-0000-000000000000",
        token_type="refresh",
        expires_delta=timedelta(days=1),
    )

    response = await api_client.post(
        "/auth/refresh",
        headers={"X-CSRF-Token": "csrf"},
        cookies={"refresh_token": token, "csrf_token": "csrf"},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "SESSION_NOT_FOUND"


async def test_logout_clears_session_and_is_idempotent(api_client, db_session) -> None:
    await _register(api_client)
    login = await _login(api_client)
    refresh = login.cookies["refresh_token"]
    csrf = login.cookies["csrf_token"]

    response = await api_client.post(
        "/auth/logout",
        cookies={"refresh_token": refresh, "csrf_token": csrf},
    )
    second = await api_client.post("/auth/logout")

    assert response.status_code == 204
    assert second.status_code == 204

    result = await db_session.execute(select(RefreshSession))
    assert all(session.revoked_at is not None for session in result.scalars().all())


async def test_logout_ignores_invalid_refresh_token(api_client) -> None:
    response = await api_client.post(
        "/auth/logout",
        cookies={"refresh_token": "invalid", "csrf_token": "csrf"},
    )

    assert response.status_code == 204


async def test_logout_all_revokes_every_session(
    api_app,
    api_client,
    db_session,
) -> None:
    user = await create_user(db_session, email="logout-all@example.com")
    await db_session.commit()
    authenticate(api_app, user)

    response = await api_client.post("/auth/logout-all")

    assert response.status_code == 204


async def test_me_endpoints_return_current_user(api_app, api_client, db_session) -> None:
    user = await create_user(db_session, email="me@example.com")
    await db_session.commit()
    authenticate(api_app, user)

    auth_me = await api_client.get("/auth/me")
    users_me = await api_client.get("/users/me")

    assert auth_me.status_code == 200
    assert auth_me.json()["email"] == "me@example.com"
    assert users_me.status_code == 200
    assert users_me.json()["id"] == str(user.id)


async def test_access_token_authentication_flow(api_client, db_session) -> None:
    await _register(api_client)
    login = await _login(api_client)
    access_token = login.json()["access_token"]

    response = await api_client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )

    assert response.status_code == 200
    assert response.json()["email"] == "person@example.com"


async def test_authentication_rejects_missing_and_invalid_tokens(api_client) -> None:
    missing = await api_client.get("/auth/me")
    invalid = await api_client.get(
        "/auth/me",
        headers={"Authorization": "Bearer invalid-token"},
    )

    assert missing.status_code == 401
    assert invalid.status_code == 401


async def test_authentication_rejects_revoked_and_expired_sessions(
    api_client,
    db_session,
) -> None:
    user = await create_user(db_session, email="revoked@example.com")
    session = RefreshSession(
        id=__import__("uuid").uuid4(),
        user_id=user.id,
        token_hash="hash",
        current_jti="jti",
        expires_at=datetime.now(UTC) + timedelta(days=1),
        revoked_at=datetime.now(UTC),
    )
    db_session.add(session)
    await db_session.commit()
    token = create_jwt_token(
        str(user.id),
        session_id=str(session.id),
        token_type="access",
        expires_delta=timedelta(minutes=5),
    )

    response = await api_client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Session revoked"
