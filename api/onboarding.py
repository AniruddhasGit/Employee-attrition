"""HR adds a person: an employee record the model can score, plus a login on a temporary password.

The form asks only what HR would know on day one. Every other model input starts from the
typical colleague in the same department and role (median for numbers, most common value for
categories), so a new joiner is scored like a typical peer until their first check-in.
"""

from collections import Counter
from statistics import median

from fastapi import HTTPException
from sqlalchemy import func, select

from api.auth import hash_password
from api.models import Employee, User
from api.service import get_service
from ml.features import CATEGORICAL, FEATURES

# The "years" columns a new joiner can't have more of than their time at the company.
CAPPED_BY_TENURE = ("YearsInCurrentRole", "YearsSinceLastPromotion", "YearsWithCurrManager")


def roles(db) -> dict[str, list[str]]:
    """Department -> job roles that exist among current staff (what the form offers)."""
    out: dict[str, set[str]] = {}
    for dept, role in db.execute(select(Employee.department, Employee.job_role)
                                 .where(Employee.is_current).distinct()):
        out.setdefault(dept, set()).add(role)
    return {d: sorted(r) for d, r in sorted(out.items())}


def typical_features(peers: list[Employee]) -> dict:
    """The typical peer: most common value for categories, median for numbers."""
    out = {}
    for f in FEATURES:
        values = [p.features[f] for p in peers]
        if f in CATEGORICAL:
            out[f] = Counter(values).most_common(1)[0][0]
        else:
            out[f] = int(round(median(values)))
    return out


def add_person(db, *, name: str, email: str, password: str, department: str, job_role: str,
               job_level: int, monthly_income: int, years_at_company: int, over_time: str,
               business_travel: str) -> tuple[Employee, User]:
    """Create the employee and their login (no commit). Raises 409/422 for HR to fix."""
    email = email.strip().lower()
    if db.scalars(select(User).where(func.lower(User.email) == email)).first():
        raise HTTPException(409, "That email already has an account.")
    peers = db.scalars(select(Employee).where(Employee.is_current,
                                              Employee.department == department,
                                              Employee.job_role == job_role)).all()
    if not peers:
        raise HTTPException(422, f"{job_role} isn't a role in {department}.")

    features = typical_features(peers)
    features.update(JobLevel=job_level, MonthlyIncome=monthly_income,
                    YearsAtCompany=years_at_company, OverTime=over_time,
                    BusinessTravel=business_travel, Department=department, JobRole=job_role)
    for f in CAPPED_BY_TENURE:
        features[f] = min(features[f], years_at_company)
    features["TotalWorkingYears"] = max(features["TotalWorkingYears"], years_at_company)

    svc = get_service()
    folds = sorted(db.scalars(select(Employee.fold).distinct()))
    new_id = (db.scalar(select(func.max(Employee.employee_id))) or 0) + 1
    # No fold model ever saw this person, so any fold scores them out of sample.
    fold = folds[new_id % len(folds)]
    score, drivers = svc.score_row(features, fold)

    person = Employee(employee_id=new_id, name=name.strip(), is_current=True, added_by_hr=True,
                      record={}, record_times={}, department=department, job_role=job_role,
                      job_level=job_level, years_at_company=years_at_company,
                      monthly_income=monthly_income, overtime=over_time, features=features,
                      risk_score=score, risk_band=svc.band(score), drivers=drivers,
                      attrition=0, fold=fold)
    db.add(person)
    db.flush()
    user = User(email=email, password_hash=hash_password(password), role="employee",
                employee_id=new_id, display_name=name.strip(), must_change_password=True)
    db.add(user)
    db.flush()
    return person, user
