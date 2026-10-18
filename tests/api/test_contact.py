from sqlalchemy import func, select

from api.db import SessionLocal
from api.models import ContactMessage

GOOD = {"name": "Ada", "email": "ada@example.com", "message": "Hello, nice project!",
        "consent": True, "website": ""}


def _count() -> int:
    with SessionLocal() as s:
        return s.scalar(select(func.count()).select_from(ContactMessage))


def test_contact_stores_message(client):
    r = client.post("/api/contact", json=GOOD)
    assert r.status_code == 200 and r.json() == {"ok": True} and _count() == 1


def test_contact_requires_consent_422(client):
    assert client.post("/api/contact", json={**GOOD, "consent": False}).status_code == 422
    assert client.post("/api/contact", json={**GOOD, "email": "nope"}).status_code == 422
    assert _count() == 0


def test_contact_honeypot_not_stored(client):
    r = client.post("/api/contact", json={**GOOD, "website": "http://spam.example"})
    assert r.status_code == 200 and r.json() == {"ok": True} and _count() == 0


def test_contact_rate_limited(client):
    from api import ratelimit

    ratelimit.reset()
    codes = [client.post("/api/contact", json=GOOD).status_code for _ in range(6)]
    assert codes == [200] * 5 + [429]
    ratelimit.reset()


def test_ip_is_hashed(client):
    from api import ratelimit

    ratelimit.reset()
    client.post("/api/contact", json=GOOD)
    with SessionLocal() as s:
        h = s.scalars(select(ContactMessage.ip_hash)).first()
    assert len(h) == 64 and "testclient" not in h and "127.0.0.1" not in h
