from __future__ import annotations

import hashlib
import hmac
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from argon2 import PasswordHasher
from argon2 import exceptions as argon2_exceptions

from app.core.config import settings

_password_hasher = PasswordHasher(time_cost=3, memory_cost=65536, parallelism=2, hash_len=32)


def hash_password(password: str) -> str:
    if not password:
        raise ValueError("Password cannot be empty")
    return _password_hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _password_hasher.verify(password_hash, password)
    except (argon2_exceptions.InvalidHash, argon2_exceptions.VerificationError):
        return False


def hash_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def verify_token_hash(raw_token: str, expected_hash: str) -> bool:
    return hmac.compare_digest(hash_token(raw_token), expected_hash)


def create_jwt_token(
    subject: str,
    *,
    session_id: str,
    token_type: str,
    jti: str | None = None,
    expires_delta: timedelta | None = None,
    audience: str | None = None,
) -> str:
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "sub": subject,
        "jti": jti or str(uuid.uuid4()),
        "sid": session_id,
        "token_type": token_type,
        "iat": int(now.timestamp()),
        "iss": settings.jwt_issuer,
        "aud": audience or settings.jwt_audience,
    }
    if expires_delta is not None:
        payload["exp"] = int((now + expires_delta).timestamp())
    secret = settings.jwt_secret_key.get_secret_value()
    return jwt.encode(payload, secret, algorithm=settings.jwt_algorithm)


def decode_and_validate_jwt(token: str) -> dict[str, Any]:
    return jwt.decode(
        token,
        settings.jwt_secret_key.get_secret_value(),
        algorithms=[settings.jwt_algorithm],
        issuer=settings.jwt_issuer,
        audience=settings.jwt_audience,
        options={
            "require": [
                "sub",
                "jti",
                "sid",
                "token_type",
                "iat",
                "exp",
                "iss",
                "aud",
            ]
        },
    )


def create_csrf_token() -> str:
    return secrets.token_urlsafe(32)
