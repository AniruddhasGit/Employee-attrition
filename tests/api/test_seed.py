import pandas as pd
from sqlalchemy import func, select

from api.db import SessionLocal
from api.models import Employee, ModelRun
from api.seed import run
from api.service import get_service
from api.settings import get_settings


def test_seed_loads_everyone(seeded):
    oof = pd.read_parquet(get_settings().models_dir / "oof.parquet").set_index("EmployeeID")
    with SessionLocal() as s:
        assert s.scalar(select(func.count()).select_from(Employee)) == 1470
        assert s.scalar(select(func.count()).select_from(Employee)
                        .where(Employee.is_current)) == 1233
        e = s.get(Employee, 1004)
        # Today's score comes from the person's latest inputs; with no plan and no answer this
        # quarter that is the IBM record, so it matches the out-of-fold score.
        assert e.record == {}
        assert round(e.risk_score, 4) == round(float(oof.loc[1004, "risk_score"]), 4)
        assert e.name
        assert not {"Gender", "Age", "MaritalStatus"} & set(e.features)
        assert len(e.features) == 27 and len(e.drivers) == 5


def test_seed_idempotent(seeded):
    with SessionLocal() as s:
        run(s, get_settings().models_dir, force=True)
        assert s.scalar(select(func.count()).select_from(Employee)) == 1470
        assert s.scalar(select(func.count()).select_from(ModelRun)) == 1


def test_band_edges():
    svc = get_service()
    assert svc.band(svc.threshold) == "high"
    assert svc.band(0.0) == "low"
    assert svc.band(svc.threshold * 0.8) == "elevated"


def test_seed_skips_when_current(seeded):
    """Free hosts restart often; re-seeding an up-to-date database must be a cheap no-op."""
    with SessionLocal() as s:
        assert run(s, get_settings().models_dir) == 0
        assert run(s, get_settings().models_dir, force=True) == 1470
