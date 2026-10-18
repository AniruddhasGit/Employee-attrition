"""The quarterly check-in: its questions, and submitting one (which re-scores the person)."""

from datetime import UTC, date, datetime

from sqlalchemy import select

from api.models import CheckIn, Employee
from api.quarters import quarter_of
from api.scoring import CHECKIN_FIELDS, effective_features
from api.service import get_service

NOTICE = ("Your HR team sees your answers, with your name, so they can act on them. "
          "Your manager does not. You will never be shown a score.")

LEVEL = [{"value": 1, "label": "Low"}, {"value": 2, "label": "Medium"},
         {"value": 3, "label": "High"}, {"value": 4, "label": "Very high"}]
BALANCE = [{"value": 1, "label": "Bad"}, {"value": 2, "label": "Good"},
           {"value": 3, "label": "Better"}, {"value": 4, "label": "Best"}]

QUESTIONS = [
    {"key": "environmentSatisfaction", "kind": "scale", "options": LEVEL,
     "label": "How satisfied are you with your work environment?"},
    {"key": "jobSatisfaction", "kind": "scale", "options": LEVEL,
     "label": "How satisfied are you with your job itself?"},
    {"key": "relationshipSatisfaction", "kind": "scale", "options": LEVEL,
     "label": "How good are your working relationships?"},
    {"key": "workLifeBalance", "kind": "scale", "options": BALANCE,
     "label": "How is your work-life balance?"},
    {"key": "jobInvolvement", "kind": "scale", "options": LEVEL,
     "label": "How involved do you feel in your work?"},
    {"key": "overTime", "kind": "yesno",
     "options": [{"value": "Yes", "label": "Yes"}, {"value": "No", "label": "No"}],
     "label": "Did you regularly work overtime this quarter?"},
    {"key": "businessTravel", "kind": "travel",
     "options": [{"value": "Non-Travel", "label": "Not at all"},
                 {"value": "Travel_Rarely", "label": "Now and then"},
                 {"value": "Travel_Frequently", "label": "Often"}],
     "label": "How often did you travel for work?"},
    {"key": "trainingTimesLastYear", "kind": "count",
     "options": [{"value": n, "label": "6 or more" if n == 6 else str(n)} for n in range(7)],
     "label": "How many training sessions did you attend in the last 12 months?"},
]

TO_API = {column: key for key, column in CHECKIN_FIELDS.items()}


def to_api_answers(answers: dict) -> dict:
    return {TO_API[c]: v for c, v in answers.items() if c in TO_API}


def submit_checkin(db, employee: Employee, answers: dict, keep_me: list[str], comment: str,
                   today: date) -> CheckIn:
    """Save this quarter's check-in (replacing an earlier one) and re-score the person.

    `answers` is keyed by model column.
    """
    svc = get_service()
    quarter = quarter_of(today)
    p, drivers = svc.score_row(effective_features(employee.features, employee.record or {},
                                                  answers), employee.fold)
    row = db.scalars(select(CheckIn).where(CheckIn.employee_id == employee.employee_id,
                                           CheckIn.quarter == quarter)).first()
    if row is None:
        row = CheckIn(employee_id=employee.employee_id, quarter=quarter, seeded=False)
        db.add(row)
    elif row.seeded and row.seed_snapshot is None:
        # A visitor re-answering a demo person's check-in: keep the original for the reset.
        row.seed_snapshot = {
            "answers": row.answers, "keep_me": row.keep_me, "comment": row.comment,
            "risk_score": row.risk_score, "drivers": row.drivers,
            "submitted_at": row.submitted_at.isoformat(),
        }
    row.answers, row.keep_me, row.comment = answers, keep_me, comment
    row.risk_score, row.drivers = p, drivers
    row.submitted_at = datetime.now(UTC)
    employee.risk_score, employee.risk_band, employee.drivers = p, svc.band(p), drivers
    db.commit()
    return row
