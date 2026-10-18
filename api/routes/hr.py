"""HR area: the dashboard, check-in status and "you said, we did" updates."""

from collections import Counter, defaultdict
from datetime import date

import pandas as pd
from fastapi import APIRouter, HTTPException, Query
from pydantic import Field
from sqlalchemy import select

from api import ratelimit
from api.auth import HrUser
from api.db import SessionDep
from api.models import CheckIn, Employee, ModelRun, TeamUpdate
from api.quarters import previous, quarter_of
from api.schemas import CamelModel
from api.scoring import KEEP_ME, PLAIN_NAMES, sharp_drop

router = APIRouter(prefix="/api/hr")

MIN_GROUP = 5  # below this, a department's expectations are not shown
UPDATES_PER_HOUR = 20


def staff(db) -> list[Employee]:
    return db.scalars(select(Employee).where(Employee.is_current)
                      .order_by(Employee.employee_id)).all()


def checkins_for(db, quarter: str) -> dict[int, CheckIn]:
    return {c.employee_id: c for c in db.scalars(select(CheckIn)
                                                 .where(CheckIn.quarter == quarter))}


def _trust(db) -> dict:
    run = db.scalars(select(ModelRun).order_by(ModelRun.created_at.desc())).first()
    if run is None:
        raise HTTPException(503, "Model not loaded yet; run the seed")
    after = run.metrics["after"]
    return {"rocAuc": after["roc_auc"], "prAuc": after["pr_auc"], "recall": after["recall"],
            "precision": after["precision"], "threshold": run.threshold,
            "nTest": run.metrics["n_test"], "fairness": run.metrics["fairness"]}


@router.get("/dashboard")
def dashboard(user: HrUser, db: SessionDep,
              replacement_pct: float = Query(50, alias="replacementPct", ge=10, le=200)) -> dict:
    people = staff(db)
    quarter = quarter_of(date.today())
    now, before = checkins_for(db, quarter), checkins_for(db, previous(quarter))
    df = pd.DataFrame([{"id": e.employee_id, "department": e.department, "job_role": e.job_role,
                        "income": e.monthly_income, "risk": e.risk_score, "band": e.risk_band}
                       for e in people])
    df["cost"] = df["risk"] * df["income"] * 12 * replacement_pct / 100
    high = df[df["band"] == "high"]

    drops = []
    by_id = {e.employee_id: e for e in people}
    for eid, cur in now.items():
        prev = before.get(eid)
        if eid not in by_id or prev is None:
            continue
        flagged = sharp_drop(prev.answers, cur.answers, prev.risk_score, cur.risk_score)
        if not flagged:
            continue
        e = by_id[eid]
        drops.append({
            "id": eid, "name": e.name, "department": e.department, "jobRole": e.job_role,
            "riskScore": cur.risk_score, "prevRiskScore": prev.risk_score,
            "fields": [{"column": c, "label": PLAIN_NAMES[c], "from": prev.answers[c],
                        "to": cur.answers[c]} for c in flagged if c != "risk"],
            "riskJump": "risk" in flagged,
        })
    drops.sort(key=lambda x: x["prevRiskScore"] - x["riskScore"])

    heat = (df.groupby(["department", "job_role"])
            .agg(n=("risk", "size"), meanRisk=("risk", "mean"), expectedCost=("cost", "sum"))
            .reset_index())

    themes = []
    for dept, rows in sorted(_by_department(people, now).items()):
        counts = Counter(k for c in rows for k in c.keep_me)
        hidden = len(rows) < MIN_GROUP
        themes.append({
            "department": dept, "n": len(rows), "hidden": hidden,
            "top": [] if hidden else [{"key": k, "label": KEEP_ME[k],
                                       "share": round(n / len(rows), 4)}
                                      for k, n in counts.most_common(3)],
        })

    prev_scores = [c.risk_score for eid, c in before.items() if eid in by_id]
    return {
        "quarter": quarter,
        "previousQuarter": previous(quarter),
        "headcount": len(people),
        "highRisk": len(high),
        "costAtStake": float((high["income"] * 12 * replacement_pct / 100).sum()),
        "replacementPct": replacement_pct,
        "meanRisk": round(float(df["risk"].mean()), 4),
        "meanRiskPrev": round(sum(prev_scores) / len(prev_scores), 4) if prev_scores else None,
        "responseRate": round(sum(1 for eid in now if eid in by_id) / len(people), 4),
        "sharpDrops": drops,
        "heatmap": [{"department": r.department, "jobRole": r.job_role, "n": int(r.n),
                     "meanRisk": round(float(r.meanRisk), 4),
                     "expectedCost": float(r.expectedCost)} for r in heat.itertuples()],
        "keepThemes": themes,
        "trust": _trust(db),
    }


def _by_department(people: list[Employee], now: dict[int, CheckIn]) -> dict[str, list]:
    out: dict[str, list] = defaultdict(list)
    for e in people:
        if e.employee_id in now:
            out[e.department].append(now[e.employee_id])
        else:
            out.setdefault(e.department, [])
    return out


@router.get("/check-ins")
def checkin_status(user: HrUser, db: SessionDep) -> dict:
    people = staff(db)
    quarter = quarter_of(date.today())
    now = checkins_for(db, quarter)
    totals, answered = Counter(), Counter()
    missing = []
    for e in people:
        totals[e.department] += 1
        if e.employee_id in now:
            answered[e.department] += 1
        else:
            missing.append({"id": e.employee_id, "name": e.name, "department": e.department,
                            "jobRole": e.job_role})
    missing.sort(key=lambda m: (m["department"], m["name"]))
    updates = db.scalars(select(TeamUpdate)
                         .order_by(TeamUpdate.created_at.desc(), TeamUpdate.id.desc())
                         .limit(30)).all()
    return {
        "quarter": quarter,
        "responseRate": round(sum(answered.values()) / len(people), 4),
        "byDepartment": [{"department": d, "answered": answered[d], "total": totals[d]}
                         for d in sorted(totals)],
        "missing": missing,
        "updates": [{"id": u.id, "department": u.department, "quarter": u.quarter,
                     "said": u.said, "did": u.did} for u in updates],
    }


class UpdateIn(CamelModel):
    department: str = Field(min_length=1, max_length=64)
    said: str = Field(min_length=1, max_length=280)
    did: str = Field(min_length=1, max_length=280)


@router.post("/updates", status_code=201)
def post_update(body: UpdateIn, user: HrUser, db: SessionDep) -> dict:
    if not ratelimit.allow(f"update:{user.id}", UPDATES_PER_HOUR, 3600):
        raise HTTPException(429, "That's a lot of updates this hour. Come back later.")
    departments = set(db.scalars(select(Employee.department).where(Employee.is_current)))
    if body.department not in departments:
        raise HTTPException(422, "Pick one of the company's departments.")
    u = TeamUpdate(department=body.department, quarter=quarter_of(date.today()),
                   said=body.said.strip(), did=body.did.strip(), created_by=user.id,
                   seeded=False)
    db.add(u)
    db.commit()
    return {"id": u.id, "department": u.department, "quarter": u.quarter, "said": u.said,
            "did": u.did}
