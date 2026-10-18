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
    with TestClient(app) as c:
        yield c
    with engine.begin() as conn:
        conn.execute(text(
            "TRUNCATE sessions, check_ins, action_plans, team_updates, contact_messages"
            " RESTART IDENTITY CASCADE"
        ))


@pytest.fixture(scope="session")
def seeded(_schema):
    """Seed the test DB once from the real Phase A artifacts."""
    from api.db import SessionLocal
    from api.seed import run
    from api.settings import get_settings

    with SessionLocal() as s:
        run(s, get_settings().models_dir)
    return True
