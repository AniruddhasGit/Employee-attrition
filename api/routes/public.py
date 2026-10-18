"""Company-wide figures for the public landing page. Aggregates only; never a person."""

from collections import Counter

from fastapi import APIRouter
from sqlalchemy import select

from api.db import SessionDep
from api.models import Employee, ModelRun

router = APIRouter(prefix="/api/public")

MIN_GROUP = 10
FEATURE_TEXT = {
    "OverTime": "works overtime", "MonthlyIncome": "lower pay for their level",
    "StockOptionLevel": "no stock options", "JobLevel": "a junior job level",
    "YearsAtCompany": "short time at the company", "TotalWorkingYears": "a short career so far",
    "EnvironmentSatisfaction": "low workplace satisfaction",
    "JobSatisfaction": "low job satisfaction", "WorkLifeBalance": "poor work-life balance",
    "BusinessTravel": "frequent travel", "DistanceFromHome": "a long commute",
    "JobInvolvement": "low job involvement",
    "RelationshipSatisfaction": "strained working relationships",
    "NumCompaniesWorked": "many previous employers",
    "YearsSinceLastPromotion": "a long wait since promotion",
    "YearsWithCurrManager": "little time with their manager",
    "YearsInCurrentRole": "little time in their role",
    "TrainingTimesLastYear": "little training", "JobRole": "their job role",
}


@router.get("/summary")
def summary(db: SessionDep) -> dict:
    run = db.scalars(select(ModelRun).order_by(ModelRun.created_at.desc())).first()
    all_people = db.scalars(select(Employee)).all()
    staff = [e for e in all_people if e.is_current]

    groups: dict[tuple[str, str], list[float]] = {}
    for e in staff:
        groups.setdefault((e.department, e.job_role), []).append(e.risk_score)
    (dept, role), scores = max(((k, v) for k, v in groups.items() if len(v) >= MIN_GROUP),
                               key=lambda kv: sum(kv[1]) / len(kv[1]))

    def left(overtime: str) -> float:
        group = [e for e in all_people if e.overtime == overtime]
        return round(sum(e.attrition for e in group) / len(group), 4)

    raising = Counter(d["feature"] for e in staff for d in e.drivers if d["direction"] == "raises")
    feature, count = next((f, c) for f, c in raising.most_common() if f in FEATURE_TEXT)
    return {
        "metrics": {"before": run.metrics["before"], "after": run.metrics["after"],
                    "nTest": run.metrics["n_test"]},
        "riskiest": {"department": dept, "jobRole": role, "n": len(scores),
                     "meanRisk": round(sum(scores) / len(scores), 4)},
        "overtime": {"yes": left("Yes"), "no": left("No")},
        "topDriver": {"text": FEATURE_TEXT[feature], "share": round(count / len(staff), 4)},
    }
