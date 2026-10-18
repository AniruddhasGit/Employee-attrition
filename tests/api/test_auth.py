import hashlib
from datetime import UTC, datetime, timedelta

from sqlalchemy import select, update

from api.db import SessionLocal
from api.models import Session as UserSession
from tests.api.conftest import ORIGIN, login


def test_login_sets_httponly_cookie_and_routes_by_role(client, make_user, seeded):
    hr = make_user("hr")
    r = login(client, hr.email)
    assert r.status_code == 200 and r.json() == {"role": "hr", "displayName": "Test hr",
                                                 "home": "/hr"}
    cookie = r.headers["set-cookie"]
    assert "retain_session=" in cookie and "HttpOnly" in cookie
    assert "samesite=lax" in cookie.lower() and "Path=/" in cookie
    assert client.get("/api/auth/me").json()["home"] == "/hr"

    client.cookies.clear()
    emp = make_user("employee", employee_id=1004)
    assert login(client, emp.email).json()["home"] == "/me"


def test_wrong_password_and_unknown_email_same_response(client, make_user):
    u = make_user("hr")
    a = login(client, u.email, "nope-nope")
    b = login(client, "nobody@test.local", "nope-nope")
    assert a.status_code == b.status_code == 401
    assert a.json() == b.json() == {"detail": "Email or password is wrong."}


def test_session_stored_hashed(client, make_user):
    u = make_user("hr")
    login(client, u.email)
    raw = client.cookies.get("retain_session")
    with SessionLocal() as s:
        hashes = s.scalars(select(UserSession.token_hash)).all()
    assert raw not in hashes
    assert hashlib.sha256(raw.encode()).hexdigest() in hashes


def test_expired_session_is_401(client, make_user):
    u = make_user("hr")
    login(client, u.email)
    with SessionLocal() as s:
        s.execute(update(UserSession).values(expires_at=datetime.now(UTC) - timedelta(minutes=1)))
        s.commit()
    assert client.get("/api/auth/me").status_code == 401


def test_logout_deletes_session(client, make_user):
    u = make_user("hr")
    login(client, u.email)
    assert client.post("/api/auth/logout", headers=ORIGIN).status_code == 204
    with SessionLocal() as s:
        assert s.scalars(select(UserSession)).all() == []
    assert client.get("/api/auth/me").status_code == 401


def test_login_rate_limit_per_email(client, make_user):
    u = make_user("hr")
    codes = [login(client, u.email, "wrong-pass").status_code for _ in range(11)]
    assert codes[:10] == [401] * 10 and codes[10] == 429


def test_write_without_origin_is_403(client, make_user):
    u = make_user("hr")
    r = client.post("/api/auth/login", json={"email": u.email, "password": "pw-correct-horse"},
                    headers={"Origin": ""})
    assert r.status_code == 403
    bad = client.post("/api/auth/login", json={"email": u.email, "password": "pw-correct-horse"},
                      headers={"Origin": "https://evil.example"})
    assert bad.status_code == 403
    assert login(client, u.email).status_code == 200


def test_demo_accounts_are_not_listed_publicly(client, seeded):
    assert client.get("/api/auth/demo-accounts").status_code in (404, 405)


def test_demo_passwords_follow_the_setting(seeded, monkeypatch):
    """Changing DEMO_PASSWORD on the host takes effect at the next start, without a reseed."""
    from api import demo
    from api.auth import verify_password
    from api.db import SessionLocal
    from api.models import User
    from api.settings import get_settings

    settings = get_settings()
    monkeypatch.setattr(settings, "demo_password", "a-much-longer-secret")
    with SessionLocal() as s:
        assert demo.sync_passwords(s) == 5
        users = s.query(User).filter(User.email.like("%@retain.demo")).all()
        assert all(verify_password(u.password_hash, "a-much-longer-secret") for u in users)
        assert demo.sync_passwords(s) == 0  # already current: nothing rehashed
    monkeypatch.setattr(settings, "demo_password", "retain-demo")
    with SessionLocal() as s:
        demo.sync_passwords(s)


def test_successful_sign_ins_are_not_rate_limited(client, make_user):
    """Many prospects share one demo account; only failed attempts count toward the limit."""
    u = make_user("hr")
    assert all(login(client, u.email).status_code == 200 for _ in range(15))


def test_wrong_passwords_from_one_ip_do_not_lock_out_others(client, make_user):
    """Demo accounts are shared and their emails public: one visitor must not lock everyone out."""
    u = make_user("hr")
    attacker = {"x-forwarded-for": "198.51.100.66"}
    for _ in range(10):
        client.post("/api/auth/login", json={"email": u.email, "password": "wrong-pass"},
                    headers=attacker)
    assert client.post("/api/auth/login", json={"email": u.email, "password": "wrong-pass"},
                       headers=attacker).status_code == 429
    other = client.post("/api/auth/login", json={"email": u.email, "password": "pw-correct-horse"},
                        headers={"x-forwarded-for": "203.0.113.10"})
    assert other.status_code == 200
