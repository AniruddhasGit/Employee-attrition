from datetime import date

from sqlalchemy import func, select

from api import demo
from api.checkins import NOTICE
from api.db import SessionLocal
from api.models import CheckIn, Employee
from api.quarters import quarter_of
from api.scoring import effective_features
from api.service import get_service
from tests.api.conftest import login

FORBIDDEN = {"riskScore", "riskBand", "drivers", "before", "after", "delta", "score",
             "risk_score", "risk_band"}

ANSWERS = {
    "environmentSatisfaction": 2, "jobSatisfaction": 1, "relationshipSatisfaction": 3,
    "workLifeBalance": 1, "jobInvolvement": 2, "overTime": "Yes",
    "businessTravel": "Travel_Frequently", "trainingTimesLastYear": 1,
}


def _keys(obj, out=None):
    out = set() if out is None else out
    if isinstance(obj, dict):
        for k, v in obj.items():
            out.add(k)
            _keys(v, out)
    elif isinstance(obj, list):
        for v in obj:
            _keys(v, out)
    return out


def _sign_in(client, story="not_answered"):
    with SessionLocal() as s:
        p = next(p for p in demo.personas(s) if p["story"] == story)
    assert login(client, p["email"], "retain-demo").status_code == 200
    return p


def _post(client, **overrides):
    body = {"answers": ANSWERS, "keepMe": ["flexibility", "less_overtime"],
            "comment": "Late finishes."} | overrides
    return client.post("/api/me/check-in", json=body)


def test_me_never_exposes_scores(client, seeded):
    _sign_in(client)
    bodies = [client.get("/api/me").json(), client.get("/api/me/check-in").json()]
    posted = _post(client)
    assert posted.status_code == 201
    bodies += [posted.json(), client.get("/api/me").json()]
    for body in bodies:
        assert not FORBIDDEN & _keys(body), FORBIDDEN & _keys(body)


def test_checkin_rescores_employee(client, seeded):
    p = _sign_in(client)
    assert _post(client).status_code == 201
    svc = get_service()
    with SessionLocal() as s:
        e = s.get(Employee, p["employee_id"])
        row = s.scalars(select(CheckIn).where(CheckIn.employee_id == e.employee_id,
                                              CheckIn.quarter == quarter_of(date.today()))).one()
        feats = effective_features(e.features, e.record, row.answers)
        expected = svc.score_row(feats, e.fold)[0]
        assert abs(e.risk_score - expected) < 1e-9 and abs(row.risk_score - expected) < 1e-9
        assert row.answers["WorkLifeBalance"] == 1 and row.keep_me == ["flexibility",
                                                                        "less_overtime"]


def test_resubmit_same_quarter_replaces(client, seeded):
    p = _sign_in(client)
    assert _post(client).status_code == 201
    assert _post(client, answers={**ANSWERS, "workLifeBalance": 4}).status_code == 201
    with SessionLocal() as s:
        rows = s.scalars(select(CheckIn).where(CheckIn.employee_id == p["employee_id"],
                                               CheckIn.quarter == quarter_of(date.today()))).all()
        assert len(rows) == 1 and rows[0].answers["WorkLifeBalance"] == 4
    assert client.get("/api/me").json()["checkInStatus"] == "done"


def test_checkin_validation(client, seeded):
    _sign_in(client)
    assert _post(client, answers={**ANSWERS, "jobSatisfaction": 5}).status_code == 422
    assert _post(client, keepMe=["pay", "growth", "manager", "security"]).status_code == 422
    assert _post(client, keepMe=["free_lunch"]).status_code == 422
    assert _post(client, comment="x" * 501).status_code == 422
    missing = {k: v for k, v in ANSWERS.items() if k != "overTime"}
    assert _post(client, answers=missing).status_code == 422


def test_notice_verbatim(client, seeded):
    _sign_in(client)
    body = client.get("/api/me/check-in").json()
    assert body["notice"] == NOTICE == (
        "Your HR team sees your answers, with your name, so they can act on them. "
        "Your manager does not. You will never be shown a score.")
    assert len(body["questions"]) == 8
    assert body["questions"][0]["options"][0] == {"value": 1, "label": "Low"}


def test_me_home_contents(client, seeded):
    p = _sign_in(client, "stable")
    body = client.get("/api/me").json()
    assert body["displayName"] == p["display_name"] and body["checkInStatus"] == "done"
    assert body["history"][0]["quarter"] == quarter_of(date.today())
    assert set(body["history"][0]["answers"]) == set(ANSWERS)
    assert body["updates"] and len(body["updates"]) <= 8
    assert [o["key"] for o in body["keepMeOptions"]][:2] == ["pay", "growth"]


def test_me_requires_login(client, seeded):
    assert client.get("/api/me").status_code == 401
    assert client.get("/api/me/check-in").status_code == 401


def test_checkin_rate_limit(client, seeded):
    _sign_in(client)
    codes = [_post(client).status_code for _ in range(11)]
    assert codes[:10] == [201] * 10 and codes[10] == 429
    with SessionLocal() as s:
        assert s.scalar(select(func.count()).select_from(CheckIn).where(~CheckIn.seeded)) == 1
