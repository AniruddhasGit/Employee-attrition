from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import Field
from sqlalchemy import func, select

from api import demo, ratelimit
from api.auth import COOKIE, CurrentUser, close_session, home_for, open_session, verify_password
from api.db import SessionDep
from api.models import User
from api.net import client_ip
from api.schemas import CamelModel
from api.settings import get_settings

router = APIRouter(prefix="/api/auth")

ATTEMPTS, WINDOW_S = 10, 15 * 60


class LoginIn(CamelModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=200)


class Me(CamelModel):
    role: str
    display_name: str
    home: str


def _me(user: User) -> Me:
    return Me(role=user.role, display_name=user.display_name, home=home_for(user))


@router.post("/login", response_model=Me, response_model_by_alias=True)
def login(body: LoginIn, request: Request, response: Response, db: SessionDep):
    email = body.email.strip().lower()
    # Only failed attempts count: many prospects share one demo account.
    keys = (f"login-ip:{client_ip(request)}", f"login-email:{email}")
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


@router.get("/demo-accounts")
def demo_accounts(db: SessionDep) -> list[dict]:
    """The five public demo sign-ins (fictional people; the password is shown on the page)."""
    return [{"email": p["email"], "label": p["label"], "role": p["role"]}
            for p in demo.personas(db)]
