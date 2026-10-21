from __future__ import annotations

import hashlib
import secrets
import time
from datetime import datetime, timedelta, timezone
from typing import Any

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import HTTPException, Request, status
from starlette.responses import Response

from app.config import Settings

_passwords = PasswordHasher()
_rate: dict[tuple[str, str], list[float]] = {}


def hash_password(password: str) -> str:
    return _passwords.hash(password)


def verify_password(password: str, encoded: str) -> bool:
    try:
        return _passwords.verify(encoded, password)
    except VerifyMismatchError:
        return False


def new_token() -> str:
    return secrets.token_urlsafe(48)


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def allow_attempt(request: Request, action: str, settings: Settings) -> bool:
    key = (request.client.host if request.client else "unknown", action)
    now = time.monotonic(); attempts = [t for t in _rate.get(key, []) if now - t < settings.rate_limit_window_seconds]
    if len(attempts) >= settings.rate_limit_max_attempts:
        _rate[key] = attempts; return False
    attempts.append(now); _rate[key] = attempts; return True


def secure_cookie(request: Request, settings: Settings) -> bool:
    forwarded = request.headers.get("forwarded", "").lower()
    cloud_proto = request.headers.get("x-forwarded-proto", "").lower()
    forwarded_https = settings.trust_proxy_headers and ("proto=https" in forwarded or cloud_proto == "https")
    is_https = forwarded_https or settings.public_https or settings.secure_cookies
    host = request.headers.get("host", "").split(":")[0].lower()
    return is_https and host not in {"localhost", "127.0.0.1", "::1"}


def set_session_cookies(response: Response, request: Request, settings: Settings, session_token: str, csrf_token: str) -> None:
    secure = secure_cookie(request, settings)
    response.set_cookie(settings.cookie_name, session_token, httponly=True, secure=secure, samesite="none" if secure else "lax", max_age=settings.session_ttl_hours * 3600, path="/")
    response.set_cookie("cynbit_csrf", csrf_token, httponly=False, secure=secure, samesite="none" if secure else "lax", max_age=settings.session_ttl_hours * 3600, path="/")


def clear_session_cookies(response: Response, settings: Settings) -> None:
    response.delete_cookie(settings.cookie_name, path="/")
    response.delete_cookie("cynbit_csrf", path="/")


async def current_session(request: Request, repo: Any, settings: Settings) -> dict[str, Any]:
    token = request.cookies.get(settings.cookie_name)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    session = await repo.get_session(token_hash(token))
    if not session or session["expires_at"] <= datetime.now(timezone.utc):
        if session: await repo.delete_session(token_hash(token))
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired or invalid")
    return session


async def require_csrf(request: Request, repo: Any, settings: Settings) -> dict[str, Any]:
    session = await current_session(request, repo, settings)
    supplied = request.headers.get("x-csrf-token")
    if not supplied or not secrets.compare_digest(supplied, session["csrf_token"]):
        raise HTTPException(status_code=403, detail="CSRF token missing or invalid")
    return session


def session_expiry(settings: Settings) -> datetime:
    return datetime.now(timezone.utc) + timedelta(hours=settings.session_ttl_hours)
