from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import func, select

from api.db import SessionDep
from api.models import Employee
from api.schemas import (
    LEVER_FEATURES,
    Band,
    EmployeeCard,
    EmployeeDetail,
    EmployeePage,
    Levers,
    SimulateIn,
    SimulateOut,
)
from api.service import get_service

router = APIRouter(prefix="/api")


def to_card(e: Employee) -> EmployeeCard:
    return EmployeeCard(
        id=e.employee_id, department=e.department, job_role=e.job_role, job_level=e.job_level,
        years_at_company=e.years_at_company, monthly_income=e.monthly_income,
        over_time=e.overtime, risk_score=e.risk_score, risk_band=e.risk_band, drivers=e.drivers,
    )


def get_employee(session, employee_id: int) -> Employee:
    e = session.get(Employee, employee_id)
    if e is None:
        raise HTTPException(404, f"Employee {employee_id} not found")
    return e


@router.get("/employees", response_model=EmployeePage, response_model_by_alias=True)
def list_employees(
    session: SessionDep,
    department: str | None = None,
    job_role: str | None = Query(None, alias="jobRole"),
    band: Band | None = None,
    sort: Literal["risk", "id"] = "risk",
    limit: int = Query(24, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    q = select(Employee)
    if department:
        q = q.where(Employee.department == department)
    if job_role:
        q = q.where(Employee.job_role == job_role)
    if band:
        q = q.where(Employee.risk_band == band)
    total = session.scalar(select(func.count()).select_from(q.subquery()))
    order = Employee.risk_score.desc() if sort == "risk" else Employee.employee_id
    rows = session.scalars(q.order_by(order).limit(limit).offset(offset)).all()
    return EmployeePage(items=[to_card(e) for e in rows], total=total)


@router.get("/employees/random", response_model=EmployeeCard, response_model_by_alias=True)
def random_employee(session: SessionDep, band: Band | None = None):
    q = select(Employee)
    if band:
        q = q.where(Employee.risk_band == band)
    e = session.scalars(q.order_by(func.random()).limit(1)).first()
    if e is None:
        raise HTTPException(404, "No employee matches")
    return to_card(e)


@router.get("/employees/{employee_id}", response_model=EmployeeDetail,
            response_model_by_alias=True)
def employee_detail(employee_id: int, session: SessionDep):
    e = get_employee(session, employee_id)
    levers = Levers.from_features({f: e.features[f] for f in LEVER_FEATURES})
    return EmployeeDetail(**to_card(e).model_dump(), levers=levers)


@router.post("/simulate", response_model=SimulateOut, response_model_by_alias=True)
def simulate(body: SimulateIn, session: SessionDep):
    e = get_employee(session, body.employee_id)
    svc = get_service()
    overrides = body.levers.to_features()
    if overrides:
        after, drivers = svc.score_row(e.features, e.fold, overrides)
    else:
        after, drivers = e.risk_score, e.drivers
    return SimulateOut(
        before=e.risk_score, after=after, delta=round(after - e.risk_score, 6),
        before_band=e.risk_band, after_band=svc.band(after), drivers=drivers,
    )
