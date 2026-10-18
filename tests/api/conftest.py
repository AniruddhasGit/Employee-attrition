import os

os.environ.setdefault(
    "DATABASE_URL", "postgresql+psycopg://retain:retain@localhost:5433/retain_test"
)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

import api.models  # noqa: E402,F401
from api.db import Base, engine  # noqa: E402
from api.main import app  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def _schema():
    # Drop everything, including tables an older schema left behind, then build fresh.
    with engine.begin() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE; CREATE SCHEMA public"))
    Base.metadata.create_all(engine)
    yield


@pytest.fixture
def client():
    from api import ratelimit

    ratelimit.reset()
    # Browsers always send Origin on writes; tests that check the CSRF guard override it.
    with TestClient(app, headers={"Origin": "http://localhost:3000"}) as c:
        yield c
    with engine.begin() as conn:
        # Keep the seeded demo history; drop only what the test itself created.
        conn.execute(text("DELETE FROM sessions"))
        for table in ("check_ins", "action_plans", "team_updates"):
            conn.execute(text(f"DELETE FROM {table} WHERE NOT seeded"))
        conn.execute(text("TRUNCATE contact_messages RESTART IDENTITY"))


@pytest.fixture(scope="session")
def seeded(_schema):
    """Seed the test DB once from the real Phase A artifacts."""
    from api.db import SessionLocal
    from api.seed import run
    from api.settings import get_settings

    with SessionLocal() as s:
        run(s, get_settings().models_dir)
    return True


ORIGIN = {"Origin": "http://localhost:3000"}


@pytest.fixture
def make_user():
    """Create a user with a known password; removed again after the test."""
    from api.auth import hash_password
    from api.db import SessionLocal
    from api.models import User

    made = []

    def _make(role="employee", employee_id=None, email=None, password="pw-correct-horse"):
        with SessionLocal() as s:
            u = User(email=email or f"{role}{len(made)}@test.local", role=role,
                     password_hash=hash_password(password), employee_id=employee_id,
                     display_name=f"Test {role}")
            s.add(u)
            s.commit()
            made.append(u.id)
            return u

    yield _make
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM sessions"))
        for uid in made:
            conn.execute(text("DELETE FROM users WHERE id = :i"), {"i": uid})


def login(client, email, password="pw-correct-horse"):
    return client.post("/api/auth/login", json={"email": email, "password": password},
                       headers=ORIGIN)
