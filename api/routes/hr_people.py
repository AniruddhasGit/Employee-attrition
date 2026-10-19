"""HR area: the people list, a person's page, the what-if simulator and action plans."""

import math
from datetime import UTC, date, datetime
from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from pydantic import EmailStr, Field
from sqlalchemy import select

from api import onboarding, questions, ratelimit
from api.auth import HrUser
from api.checkins import to_api_answers
from api.db import SessionDep
from api.models import ActionPlan, CheckIn, CustomAnswer, CustomQuestion, Employee, StayIntent
from api.people import current_features, rescore
from api.quarters import previous, quarter_of
from api.routes.hr import checkins_for, staff
from api.schemas import Band, CamelModel, Levers, SimulateIn, SimulateOut
from api.scoring import ACTIONS, apply_action, change_sentence
from api.service import get_service

router = APIRouter(prefix="/api/hr")

PLANS_PER_HOUR = 60
PEOPLE_PER_HOUR = 30
TREND = 0.02

ActionKey = Literal["pay_review", "promotion", "reduce_overtime", "stock_grant", "training_plan",
                    "reduce_travel", "stay_interview"]
assert set(ActionKey.__args__) == set(ACTIONS)


def _person(db, employee_id: int) -> Employee:
    e = db.get(Employee, employee_id)
    if e is None or not e.is_current:
        raise HTTPException(404, f"No current employee {employee_id}")
    return e


@router.get("/people")
def people(user: HrUser, db: SessionDep, search: str = Query("", max_length=80),
           department: str | None = None, band: Band | None = None,
           limit: int = Query(50, ge=1, le=2000), offset: int = Query(0, ge=0)) -> dict:
    quarter = quarter_of(date.today())
    now, before = checkins_for(db, quarter), checkins_for(db, previous(quarter))
    needle = search.strip().lower()
    rows = [e for e in staff(db)
            if (not needle or needle in e.name.lower())
            and (department is None or e.department == department)
            and (band is None or e.risk_band == band)]
    rows.sort(key=lambda e: (-e.risk_score, e.employee_id))

    def trend(e: Employee) -> str:
        prev = before.get(e.employee_id)
        if prev is None:
            return "flat"
        d = e.risk_score - prev.risk_score
        return "up" if d > TREND else ("down" if d < -TREND else "flat")

    return {
        "total": len(rows),
        "items": [{"id": e.employee_id, "name": e.name, "department": e.department,
                   "jobRole": e.job_role, "riskScore": e.risk_score, "riskBand": e.risk_band,
                   "trend": trend(e), "answered": e.employee_id in now}
                  for e in rows[offset:offset + limit]],
    }


def _plan_out(p: ActionPlan, checkins: list[CheckIn]) -> dict:
    actual = None
    if p.status == "done" and p.done_at:
        after = next((c for c in checkins if c.submitted_at > p.done_at), None)
        if after is not None:
            actual = round(after.risk_score - p.score_at_creation, 6)
    return {"id": p.id, "action": p.action, "label": ACTIONS[p.action], "note": p.note,
            "status": p.status, "createdQuarter": p.created_quarter,
            "scoreAtCreation": p.score_at_creation, "estimatedScore": p.estimated_score,
            "doneAt": p.done_at.isoformat() if p.done_at else None, "actualChange": actual}


def _checkins(db, employee_id: int) -> list[CheckIn]:
    return db.scalars(select(CheckIn).where(CheckIn.employee_id == employee_id)
                      .order_by(CheckIn.quarter)).all()


@router.get("/people/{employee_id}")
def person(employee_id: int, user: HrUser, db: SessionDep) -> dict:
    e = _person(db, employee_id)
    rows = _checkins(db, employee_id)
    feats = current_features(db, e)
    plans = db.scalars(select(ActionPlan).where(ActionPlan.employee_id == employee_id)
                       .order_by(ActionPlan.created_at.desc(), ActionPlan.id.desc())).all()
    change = None
    if len(rows) >= 2:
        prev, last = rows[-2], rows[-1]
        change = change_sentence(prev.answers, last.answers, prev.risk_score, last.risk_score,
                                 prev.quarter)
    return {
        "id": e.employee_id, "name": e.name, "department": e.department,
        "jobRole": e.job_role, "jobLevel": feats["JobLevel"],
        "yearsAtCompany": e.years_at_company, "monthlyIncome": feats["MonthlyIncome"],
        "overTime": feats["OverTime"], "riskScore": e.risk_score, "riskBand": e.risk_band,
        "drivers": e.drivers,
        "levers": Levers.from_features(feats).model_dump(by_alias=True),
        "riskHistory": [{"quarter": c.quarter, "riskScore": c.risk_score} for c in rows],
        "checkIns": [{"quarter": c.quarter, "answers": to_api_answers(c.answers),
                      "keepMe": c.keep_me, "comment": c.comment or None,
                      "submittedAt": c.submitted_at.isoformat()} for c in rows],
        "change": change,
        "plans": [_plan_out(p, rows) for p in plans],
        "addedQuestions": _added_answers(db, employee_id),
        "stayIntent": _stay_intent(db, employee_id),
    }


def _added_answers(db, employee_id: int) -> list[dict]:
    """This person's latest answer to each added question still on the check-in or in the scores."""
    out = []
    rows = db.execute(select(CustomAnswer, CustomQuestion)
                      .join(CustomQuestion, CustomQuestion.id == CustomAnswer.question_id)
                      .where(CustomAnswer.employee_id == employee_id)
                      .order_by(CustomQuestion.id, CustomAnswer.quarter)).all()
    latest = {q.id: (a, q) for a, q in rows}
    for a, q in latest.values():
        effect = None
        if q.weights is not None and a.option < len(q.weights):
            effect = round(math.exp(q.weights[a.option]), 3)
        out.append({"question": q.label, "answer": q.options[a.option], "quarter": a.quarter,
                    "status": q.status, "oddsRatio": effect})
    return out


def _stay_intent(db, employee_id: int) -> dict | None:
    row = db.scalars(select(StayIntent).where(StayIntent.employee_id == employee_id)
                     .order_by(StayIntent.quarter.desc())).first()
    if row is None:
        return None
    return {"value": row.value, "label": questions.INTENT_LABELS[row.value],
            "quarter": row.quarter}


@router.post("/simulate", response_model=SimulateOut, response_model_by_alias=True)
def simulate(body: SimulateIn, user: HrUser, db: SessionDep):
    e = _person(db, body.employee_id)
    svc = get_service()
    overrides = body.levers.to_features()
    if overrides:
        after, drivers = svc.score_row(current_features(db, e), e.fold, overrides)
        after = questions.adjusted(db, e.employee_id, after)
    else:
        after, drivers = e.risk_score, e.drivers
    return SimulateOut(before=e.risk_score, after=after, delta=round(after - e.risk_score, 6),
                       before_band=e.risk_band, after_band=svc.band(after), drivers=drivers)


class PlanIn(CamelModel):
    action: ActionKey
    note: str = Field("", max_length=300)


class PlanPatch(CamelModel):
    status: Literal["done"]


@router.post("/people/{employee_id}/plans", status_code=201)
def create_plan(employee_id: int, body: PlanIn, user: HrUser, db: SessionDep) -> dict:
    if not ratelimit.allow(f"plans:{user.id}", PLANS_PER_HOUR, 3600):
        raise HTTPException(429, "That's a lot of plans this hour. Come back later.")
    e = _person(db, employee_id)
    svc = get_service()
    feats = current_features(db, e)
    estimate = questions.adjusted(db, employee_id,
                                  svc.score_row(apply_action(feats, body.action), e.fold)[0])
    plan = ActionPlan(employee_id=employee_id, action=body.action, note=body.note.strip(),
                      created_quarter=quarter_of(date.today()), created_by=user.id,
                      score_at_creation=e.risk_score, estimated_score=estimate, status="open",
                      seeded=False)
    db.add(plan)
    db.commit()
    return _plan_out(plan, [])


@router.patch("/plans/{plan_id}")
def finish_plan(plan_id: int, body: PlanPatch, user: HrUser, db: SessionDep) -> dict:
    if not ratelimit.allow(f"plans:{user.id}", PLANS_PER_HOUR, 3600):
        raise HTTPException(429, "That's a lot of plan changes this hour. Come back later.")
    plan = db.get(ActionPlan, plan_id)
    if plan is None:
        raise HTTPException(404, "No such plan")
    e = _person(db, plan.employee_id)
    if plan.status != "done":
        feats = current_features(db, e)
        changed = {k: v for k, v in apply_action(feats, plan.action).items() if feats[k] != v}
        now = datetime.now(UTC)
        e.record = {**(e.record or {}), **changed}
        e.record_times = {**(e.record_times or {}), **{k: now.isoformat() for k in changed}}
        plan.status, plan.done_at = "done", now
        rescore(db, e)
        db.commit()
    return _plan_out(plan, _checkins(db, e.employee_id))


class NewPersonIn(CamelModel):
    name: str = Field(min_length=2, max_length=80)
    email: EmailStr = Field(max_length=254)
    password: str = Field(min_length=8, max_length=200)
    department: str = Field(max_length=64)
    job_role: str = Field(max_length=64)
    job_level: int = Field(ge=1, le=5)
    monthly_income: int = Field(ge=1000, le=25000)
    years_at_company: int = Field(ge=0, le=40)
    over_time: Literal["Yes", "No"]
    business_travel: Literal["Non-Travel", "Travel_Rarely", "Travel_Frequently"]


@router.get("/roles")
def roles(user: HrUser, db: SessionDep) -> dict:
    """Departments and the job roles in each, for the add-person form."""
    return {"departments": [{"department": d, "roles": r}
                            for d, r in onboarding.roles(db).items()]}


@router.post("/people", status_code=201)
def add_person(body: NewPersonIn, user: HrUser, db: SessionDep) -> dict:
    if not ratelimit.allow(f"people:{user.id}", PEOPLE_PER_HOUR, 3600):
        raise HTTPException(429, "That's a lot of new people this hour. Come back later.")
    if not body.name.strip() or not body.password.strip():
        raise HTTPException(422, "Name and password can't be only spaces.")
    person, account = onboarding.add_person(
        db, name=body.name, email=str(body.email), password=body.password,
        department=body.department, job_role=body.job_role, job_level=body.job_level,
        monthly_income=body.monthly_income, years_at_company=body.years_at_company,
        over_time=body.over_time, business_travel=body.business_travel)
    db.commit()
    return {"id": person.employee_id, "name": person.name, "email": account.email,
            "riskScore": person.risk_score, "riskBand": person.risk_band}
