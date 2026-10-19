"""The employee's own area. Nothing here ever returns a risk score."""

from datetime import date
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import Field, field_validator
from sqlalchemy import select

from api import questions, ratelimit
from api.auth import EmployeeUser
from api.checkins import NOTICE, QUESTIONS, submit_checkin, to_api_answers
from api.db import SessionDep
from api.models import CheckIn, Employee, StayIntent, TeamUpdate
from api.quarters import quarter_of
from api.schemas import CamelModel
from api.scoring import CHECKIN_FIELDS, KEEP_ME

router = APIRouter(prefix="/api/me")

KeepKey = Literal["pay", "growth", "flexibility", "recognition", "manager", "less_overtime",
                  "learning", "less_travel", "security"]
Scale = Literal[1, 2, 3, 4]


class Answers(CamelModel):
    environment_satisfaction: Scale
    job_satisfaction: Scale
    relationship_satisfaction: Scale
    work_life_balance: Scale
    job_involvement: Scale
    over_time: Literal["Yes", "No"]
    business_travel: Literal["Non-Travel", "Travel_Rarely", "Travel_Frequently"]
    training_times_last_year: int = Field(ge=0, le=6)

    def to_columns(self) -> dict:
        data = self.model_dump(by_alias=True)
        return {CHECKIN_FIELDS[k]: v for k, v in data.items()}


class CheckInIn(CamelModel):
    answers: Answers
    # Added question id (as a string, JSON keys) -> chosen option index.
    custom: dict[str, int] = Field(default_factory=dict, max_length=20)
    stay_intent: Literal[1, 2, 3, 4, 5] | None = None
    keep_me: list[KeepKey] = Field(default_factory=list, max_length=3)
    comment: str = Field("", max_length=500)

    @field_validator("keep_me")
    @classmethod
    def _unique(cls, v: list[str]) -> list[str]:
        if len(set(v)) != len(v):
            raise ValueError("Pick each option once")
        return v


assert set(KeepKey.__args__) == set(KEEP_ME)  # the API's choices are the scoring module's

CHECKINS_PER_HOUR = 10


def _employee(db, user) -> Employee:
    e = db.get(Employee, user.employee_id)
    if e is None or not e.is_current:
        raise HTTPException(404, "No employee record for this account.")
    return e


def _rows(db, employee_id: int) -> list[CheckIn]:
    return db.scalars(select(CheckIn).where(CheckIn.employee_id == employee_id)
                      .order_by(CheckIn.quarter.desc())).all()


def _unanswered(db, employee_id: int) -> int:
    """Added questions this person hasn't answered yet (asked at their next check-in)."""
    mine = questions.latest_answers(db, [employee_id]).get(employee_id, {})
    return sum(1 for q in questions.asked(db) if q.id not in mine)


def _custom_out(db, employee_id: int) -> tuple[list[dict], dict, int | None]:
    asked = questions.asked(db)
    mine = questions.latest_answers(db, [employee_id]).get(employee_id, {})
    intent = db.scalars(select(StayIntent).where(StayIntent.employee_id == employee_id)
                        .order_by(StayIntent.quarter.desc())).first()
    return ([{"id": q.id, "label": q.label,
              "options": [{"value": i, "label": o} for i, o in enumerate(q.options)]}
             for q in asked],
            {str(q.id): mine[q.id] for q in asked if q.id in mine},
            intent.value if intent else None)


@router.get("")
def home(user: EmployeeUser, db: SessionDep) -> dict:
    e = _employee(db, user)
    quarter = quarter_of(date.today())
    rows = _rows(db, e.employee_id)
    latest = rows[0] if rows else None
    updates = db.scalars(select(TeamUpdate).where(TeamUpdate.department == e.department)
                         .order_by(TeamUpdate.quarter.desc(), TeamUpdate.id.desc())
                         .limit(8)).all()
    return {
        "displayName": user.display_name,
        "department": e.department,
        "jobRole": e.job_role,
        "quarter": quarter,
        "checkInStatus": "done" if latest and latest.quarter == quarter else "open",
        "newQuestions": _unanswered(db, e.employee_id),
        "keepMe": latest.keep_me if latest else [],
        "comment": (latest.comment or None) if latest else None,
        "keepMeOptions": [{"key": k, "label": v} for k, v in KEEP_ME.items()],
        "updates": [{"quarter": u.quarter, "said": u.said, "did": u.did} for u in updates],
        "history": [{"quarter": r.quarter, "answers": to_api_answers(r.answers),
                     "keepMe": r.keep_me, "comment": r.comment or None} for r in rows],
    }


@router.get("/check-in")
def checkin_form(user: EmployeeUser, db: SessionDep) -> dict:
    e = _employee(db, user)
    quarter = quarter_of(date.today())
    rows = _rows(db, e.employee_id)
    current = rows[0] if rows and rows[0].quarter == quarter else None
    custom_questions, custom, intent = _custom_out(db, e.employee_id)
    return {
        "quarter": quarter,
        "notice": NOTICE,
        "questions": QUESTIONS,
        "customQuestions": custom_questions,
        "intentQuestion": questions.INTENT_QUESTION,
        "keepMeOptions": [{"key": k, "label": v} for k, v in KEEP_ME.items()],
        "current": ({"answers": to_api_answers(current.answers), "keepMe": current.keep_me,
                     "comment": current.comment, "custom": custom, "stayIntent": intent}
                    if current else None),
    }


@router.post("/check-in", status_code=201)
def submit(body: CheckInIn, user: EmployeeUser, db: SessionDep) -> dict:
    if not ratelimit.allow(f"checkin:{user.id}", CHECKINS_PER_HOUR, 3600):
        raise HTTPException(429, "You've updated your check-in a lot this hour. Come back later.")
    e = _employee(db, user)
    asked = {q.id: q for q in questions.asked(db)}
    try:
        custom = {int(k): v for k, v in body.custom.items()}
    except ValueError:
        raise HTTPException(422, "Unknown question.") from None
    if set(custom) != set(asked):
        raise HTTPException(422, "Answer every question, including the new ones.")
    if any(not 0 <= v < len(asked[k].options) for k, v in custom.items()):
        raise HTTPException(422, "That isn't one of the options.")
    row = submit_checkin(db, e, body.answers.to_columns(), list(body.keep_me),
                         body.comment.strip(), date.today(), custom, body.stay_intent)
    return {"quarter": row.quarter, "status": "done"}
