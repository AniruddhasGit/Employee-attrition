"""The employee's own area. Nothing here ever returns a risk score."""

from datetime import date
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import Field, field_validator
from sqlalchemy import select

from api import ratelimit
from api.auth import EmployeeUser
from api.checkins import NOTICE, QUESTIONS, submit_checkin, to_api_answers
from api.db import SessionDep
from api.models import CheckIn, Employee, TeamUpdate
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
    return {
        "quarter": quarter,
        "notice": NOTICE,
        "questions": QUESTIONS,
        "keepMeOptions": [{"key": k, "label": v} for k, v in KEEP_ME.items()],
        "current": ({"answers": to_api_answers(current.answers), "keepMe": current.keep_me,
                     "comment": current.comment} if current else None),
    }


@router.post("/check-in", status_code=201)
def submit(body: CheckInIn, user: EmployeeUser, db: SessionDep) -> dict:
    if not ratelimit.allow(f"checkin:{user.id}", CHECKINS_PER_HOUR, 3600):
        raise HTTPException(429, "You've updated your check-in a lot this hour. Come back later.")
    e = _employee(db, user)
    row = submit_checkin(db, e, body.answers.to_columns(), list(body.keep_me),
                         body.comment.strip(), date.today())
    return {"quarter": row.quarter, "status": "done"}
