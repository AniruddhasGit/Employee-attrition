"""A person's current model inputs and score: IBM baseline, HR record overlay, latest check-in."""

from sqlalchemy import select

from api.models import CheckIn, Employee
from api.scoring import effective_features
from api.service import get_service


def latest_checkin(db, employee_id: int) -> CheckIn | None:
    return db.scalars(select(CheckIn).where(CheckIn.employee_id == employee_id)
                      .order_by(CheckIn.quarter.desc())).first()


def current_features(db, e: Employee) -> dict:
    latest = latest_checkin(db, e.employee_id)
    return effective_features(e.features, e.record or {}, latest.answers if latest else None)


def rescore(db, e: Employee) -> float:
    """Recompute the person's score and drivers from their current inputs (no commit)."""
    svc = get_service()
    p, drivers = svc.score_row(current_features(db, e), e.fold)
    e.risk_score, e.risk_band, e.drivers = p, svc.band(p), drivers
    return p
