from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import Field
from sqlalchemy import delete, func, select

from api import demo, ratelimit
from api.auth import (
    COOKIE,
    CurrentUser,
    close_session,
    digest,
    hash_password,
    home_for,
    open_session,
    verify_password,
)
from api.db import SessionDep
from api.models import Session as UserSession
from api.models import User
from api.net import client_ip
from api.schemas import CamelModel
from api.settings import get_settings

router = APIRouter(prefix="/api/auth")

ATTEMPTS, WINDOW_S = 10, 15 * 60
MIN_PASSWORD = 10


class LoginIn(CamelModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=200)


class Me(CamelModel):
    role: str
    display_name: str
    home: str
    must_change_password: bool = False


class PasswordIn(CamelModel):
    password: str = Field(min_length=MIN_PASSWORD, max_length=200)


def _me(user: User) -> Me:
    return Me(role=user.role, display_name=user.display_name, home=home_for(user),
              must_change_password=user.must_change_password)


@router.post("/login", response_model=Me, response_model_by_alias=True)
def login(body: LoginIn, request: Request, response: Response, db: SessionDep):
    email = body.email.strip().lower()
    # Only failed attempts count, keyed per IP and per (IP, email): demo emails are public and
    # shared, so a global per-email lock would let one visitor lock everyone out.
    ip = client_ip(request)
    keys = (f"login-ip:{ip}", f"login-email:{ip}:{email}")
    if any(ratelimit.blocked(k, ATTEMPTS, WINDOW_S) for k in keys):
        raise HTTPException(429, "Too many failed sign-ins. Wait 15 minutes and sign in again.")
    demo.maybe_reset(db, datetime.now(UTC), allow_full=False)
    user = db.scalars(select(User).where(func.lower(User.email) == email)).first()
    if not verify_password(user.password_hash if user else None, body.password):
        for k in keys:
            ratelimit.record(k)
        raise HTTPException(401, "Email or password is wrong.")
    settings = get_settings()
    response.set_cookie(
        COOKIE, open_session(db, user), httponly=True, samesite="lax", path="/",
        secure=settings.cookie_secure, max_age=settings.session_ttl_hours * 3600,
    )
    return _me(user)


@router.post("/logout", status_code=204)
def logout(request: Request, db: SessionDep) -> Response:
    raw = request.cookies.get(COOKIE)
    if raw:
        close_session(db, raw)
    out = Response(status_code=204)
    out.delete_cookie(COOKIE, path="/")
    return out


@router.get("/me", response_model=Me, response_model_by_alias=True)
def me(user: CurrentUser):
    return _me(user)


@router.post("/password", response_model=Me, response_model_by_alias=True)
def set_password(body: PasswordIn, request: Request, user: CurrentUser, db: SessionDep):
    """First sign-in after HR made the account: swap the temporary password for the person's own.

    Only for accounts still on a temporary password; other sessions of the account are closed.
    """
    if not user.must_change_password:
        raise HTTPException(409, "Your password is already set.")
    if not body.password.strip():
        raise HTTPException(422, "Pick a password that isn't only spaces.")
    if verify_password(user.password_hash, body.password):
        raise HTTPException(400, "Pick a password different from the temporary one.")
    user.password_hash = hash_password(body.password)
    user.must_change_password = False
    db.execute(delete(UserSession).where(UserSession.user_id == user.id,
                                         UserSession.token_hash != digest(request.cookies[COOKIE])))
    db.commit()
    return _me(user)
