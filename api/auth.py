"""Password hashing, cookie sessions, role gates and the same-origin check."""

import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from typing import Annotated

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from fastapi import Depends, HTTPException, Request
from sqlalchemy import delete, select

from api.db import SessionDep
from api.models import Session as UserSession
from api.models import User
from api.settings import get_settings

COOKIE = "retain_session"
WRITE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

# Sized for a 512 MB free instance: 19 MiB per hash (OWASP's argon2id minimum).
_hasher = PasswordHasher(time_cost=2, memory_cost=19456, parallelism=1)
# Verified against when the email is unknown, so both failures cost the same time.
_DUMMY_HASH = _hasher.hash("not-a-real-password")


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str | None, password: str) -> bool:
    try:
        return _hasher.verify(password_hash or _DUMMY_HASH, password) and password_hash is not None
    except (VerificationError, InvalidHashError):
        return False


def _digest(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def open_session(db, user: User) -> str:
    """Start a session; returns the raw token for the cookie (only its hash is stored)."""
    raw = secrets.token_urlsafe(32)
    ttl = timedelta(hours=get_settings().session_ttl_hours)
    db.add(UserSession(token_hash=_digest(raw), user_id=user.id,
                       expires_at=datetime.now(UTC) + ttl))
    db.commit()
    return raw


def close_session(db, raw: str) -> None:
    db.execute(delete(UserSession).where(UserSession.token_hash == _digest(raw)))
    db.commit()


def current_user(request: Request, db: SessionDep) -> User:
    raw = request.cookies.get(COOKIE)
    if not raw:
        raise HTTPException(401, "Please sign in.")
    row = db.scalars(select(UserSession).where(UserSession.token_hash == _digest(raw))).first()
    if row is None:
        raise HTTPException(401, "Please sign in.")
    if row.expires_at <= datetime.now(UTC):
        db.delete(row)
        db.commit()
        raise HTTPException(401, "Your session ended. Please sign in again.")
    return db.get(User, row.user_id)


CurrentUser = Annotated[User, Depends(current_user)]


def _hr(user: CurrentUser) -> User:
    if user.role != "hr":
        raise HTTPException(403, "This area is for HR.")
    return user


def _employee(user: CurrentUser) -> User:
    if user.role != "employee" or user.employee_id is None:
        raise HTTPException(403, "This area is for employees.")
    return user


HrUser = Annotated[User, Depends(_hr)]
EmployeeUser = Annotated[User, Depends(_employee)]


def require_same_origin(request: Request) -> None:
    """CSRF guard: state-changing requests must come from the site's own pages."""
    if request.method in WRITE_METHODS:
        origin = (request.headers.get("origin") or "").rstrip("/")
        if origin not in get_settings().site_origins:
            raise HTTPException(403, "Request blocked: it did not come from this site.")


def home_for(user: User) -> str:
    return "/hr" if user.role == "hr" else "/me"
