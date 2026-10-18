import pandas as pd
from sqlalchemy import select

from api.db import SessionLocal
from api.models import Employee
from api.service import get_service
from ml.features import FEATURES


def test_score_frame_matches_score_row(seeded):
    svc = get_service()
    with SessionLocal() as s:
        people = s.scalars(select(Employee).order_by(Employee.employee_id).limit(50)).all()
    df = pd.DataFrame([{**e.features, "fold": e.fold} for e in people])
    scores = svc.score_frame(df)
    assert len(scores) == 50
    for e, p in zip(people, scores, strict=True):
        assert abs(p - svc.score_row(e.features, e.fold)[0]) < 1e-9
    assert set(FEATURES) <= set(df.columns)


def test_drivers_for(seeded):
    svc = get_service()
    with SessionLocal() as s:
        e = s.get(Employee, 1004)
    drivers = svc.drivers_for(e.features, e.fold)
    assert len(drivers) == 5
    assert {"feature", "text", "impact"} <= set(drivers[0])
