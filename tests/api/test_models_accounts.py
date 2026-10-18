import pytest
from sqlalchemy.exc import IntegrityError

from api.db import SessionLocal
from api.models import CheckIn, Employee, User
from api.settings import Settings


def _employee(eid: int) -> Employee:
    return Employee(
        employee_id=eid, name="Test Person", is_current=True, department="Sales",
        job_role="Sales Executive", job_level=2, years_at_company=3, monthly_income=5000,
        overtime="No", features={}, risk_score=0.1, risk_band="low", drivers=[], attrition=0,
        fold=0,
    )


def test_accounts_schema_roundtrip():
    with SessionLocal() as s:
        s.add(_employee(990001))
        s.flush()
        s.add(User(email="a@x.test", password_hash="h", role="employee", employee_id=990001,
                   display_name="A"))
        s.add_all([
            CheckIn(employee_id=990001, quarter="2026-Q3", answers={}, keep_me=[], comment="",
                    risk_score=0.1, seeded=True),
            CheckIn(employee_id=990001, quarter="2026-Q4", answers={}, keep_me=[], comment="",
                    risk_score=0.2, seeded=False),
        ])
        s.commit()
        assert s.get(Employee, 990001).record == {}

        s.add(CheckIn(employee_id=990001, quarter="2026-Q4", answers={}, keep_me=[], comment="",
                      risk_score=0.3, seeded=False))
        with pytest.raises(IntegrityError):
            s.commit()
        s.rollback()

        s.add(User(email="a@x.test", password_hash="h", role="hr", display_name="B"))
        with pytest.raises(IntegrityError):
            s.commit()
        s.rollback()

        s.query(CheckIn).filter_by(employee_id=990001).delete()
        s.query(User).filter_by(employee_id=990001).delete()
        s.query(Employee).filter_by(employee_id=990001).delete()
        s.commit()


def test_settings_accounts_defaults():
    assert Settings().session_ttl_hours == 12
    s = Settings(site_origins="https://a.com/,https://b.com")
    assert s.site_origins == ["https://a.com", "https://b.com"]
