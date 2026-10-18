"""A person's current model inputs and score: IBM baseline, HR record overlay, latest check-in."""

from datetime import datetime

from sqlalchemy import select

from api.models import CheckIn, Employee
from api.scoring import effective_features
from api.service import get_service


def latest_checkin(db, employee_id: int) -> CheckIn | None:
    return db.scalars(select(CheckIn).where(CheckIn.employee_id == employee_id)
                      .order_by(CheckIn.quarter.desc())).first()


def current_features(db, e: Employee) -> dict:
    """Baseline, then the HR record, then the latest check-in - except record fields HR changed
    after that check-in (e.g. "overtime reduced"), which win until the next check-in."""
    latest = latest_checkin(db, e.employee_id)
    record = e.record or {}
    if latest is None:
        return effective_features(e.features, record, None)
    times = e.record_times or {}
    newer = {k: v for k, v in record.items()
             if k in times and datetime.fromisoformat(times[k]) > latest.submitted_at}
    return {**effective_features(e.features, record, latest.answers), **newer}


def rescore(db, e: Employee) -> float:
    """Recompute the person's score and drivers from their current inputs (no commit)."""
    svc = get_service()
    p, drivers = svc.score_row(current_features(db, e), e.fold)
    e.risk_score, e.risk_band, e.drivers = p, svc.band(p), drivers
    return p
