import secrets

from fastapi import APIRouter, HTTPException, Request
from sqlalchemy import select

from api import ratelimit
from api.db import SessionDep
from api.models import Scenario
from api.routes.contact import client_ip, ip_hash
from api.routes.employees import get_employee, to_card
from api.schemas import CamelModel, EmployeeCard, Levers
from api.service import get_service

router = APIRouter(prefix="/api")

SAVES_PER_HOUR = 30  # keeps a free 0.5 GB database from being filled by one client


class ScenarioIn(CamelModel):
    employee_id: int
    levers: Levers = Levers()


class ScenarioOut(CamelModel):
    public_id: str
    employee: EmployeeCard
    levers: Levers
    before: float
    after: float
    delta: float
    created_at: str


@router.post("/scenarios", status_code=201)
def save_scenario(body: ScenarioIn, request: Request, session: SessionDep) -> dict:
    if not ratelimit.allow(f"scenario:{ip_hash(client_ip(request))}", SAVES_PER_HOUR, 3600):
        raise HTTPException(429, "Too many saved scenarios. Please try again later.")
    e = get_employee(session, body.employee_id)
    overrides = body.levers.to_features()
    after = get_service().score_row(e.features, e.fold, overrides)[0] if overrides else e.risk_score
    s = Scenario(public_id=secrets.token_urlsafe(8)[:10], employee_id=e.employee_id,
                 levers=body.levers.model_dump(by_alias=True, exclude_none=True),
                 before=e.risk_score, after=after)
    session.add(s)
    session.commit()
    return {"publicId": s.public_id}


@router.get("/scenarios/{public_id}", response_model=ScenarioOut, response_model_by_alias=True)
def get_scenario(public_id: str, session: SessionDep):
    s = session.scalars(select(Scenario).where(Scenario.public_id == public_id)).first()
    if s is None:
        raise HTTPException(404, "Scenario not found")
    e = get_employee(session, s.employee_id)
    return ScenarioOut(public_id=s.public_id, employee=to_card(e),
                       levers=Levers.model_validate(s.levers), before=s.before, after=s.after,
                       delta=s.after - s.before, created_at=s.created_at.isoformat())
