from datetime import date

import numpy as np
from sqlalchemy import func, select

from api import demo, questions
from api.db import SessionLocal
from api.models import CustomQuestion, Employee
from tests.api.conftest import ORIGIN, login
from tests.api.test_me import ANSWERS, _sign_in

NEW = [{"label": "How clear is your path to the next role?",
        "options": ["Very clear", "Somewhat clear", "Unclear"]},
       {"label": "Do you have the tools you need?", "options": ["Yes", "Mostly", "No"]}]


def _as_hr(client):
    with SessionLocal() as s:
        hr = next(p for p in demo.personas(s) if p["story"] == "hr")
    assert login(client, hr["email"], "retain-demo").status_code == 200


def _mean_risk():
    with SessionLocal() as s:
        return s.scalar(select(func.avg(Employee.risk_score)).where(Employee.is_current))


def test_fit_recovers_a_known_effect():
    rng = np.random.default_rng(1)
    n = 3000
    offset = rng.normal(-1.5, 1.0, n)
    option = rng.integers(0, 3, n)
    X = np.eye(3)[option]
    true = np.array([-0.8, 0.0, 0.9])
    y = (rng.random(n) < 1 / (1 + np.exp(-(offset + X @ true)))).astype(float)
    beta = questions._fit(offset, X, y, l2=0.1)
    w = beta[2:] - beta[2:].mean()
    assert np.allclose(w, true - true.mean(), atol=0.2)
    assert abs(beta[0] - 1.0) < 0.15


def test_new_questions_wait_for_answers_then_recompute(client, seeded):
    _as_hr(client)
    before = _mean_risk()
    r = client.post("/api/hr/questions", json={"questions": NEW}, headers=ORIGIN)
    assert r.status_code == 201, r.text
    st = r.json()
    assert [q["status"] for q in st["questions"]] == ["pending", "pending"]
    assert st["recompute"] == {"needed": True, "ready": False, "coverage": 0.0, "last": None,
                               "reason": st["recompute"]["reason"]}
    assert client.post("/api/hr/questions/recompute", headers=ORIGIN).status_code == 409

    # An employee is asked the new questions and must answer them.
    client.cookies.clear()
    _sign_in(client)
    assert client.get("/api/me").json()["newQuestions"] == 2
    form = client.get("/api/me/check-in").json()
    ids = [q["id"] for q in form["customQuestions"]]
    assert len(ids) == 2 and form["intentQuestion"]["options"][0]["label"] == "Yes, definitely"
    body = {"answers": ANSWERS, "keepMe": [], "comment": "", "stayIntent": 4}
    assert client.post("/api/me/check-in", json=body, headers=ORIGIN).status_code == 422
    body["custom"] = {str(ids[0]): 2, str(ids[1]): 9}
    assert client.post("/api/me/check-in", json=body, headers=ORIGIN).status_code == 422
    body["custom"] = {str(ids[0]): 2, str(ids[1]): 1}
    assert client.post("/api/me/check-in", json=body, headers=ORIGIN).status_code == 201
    assert client.get("/api/me").json()["newQuestions"] == 0
    assert client.get("/api/me/check-in").json()["current"]["stayIntent"] == 4

    client.cookies.clear()
    _as_hr(client)
    st = client.post("/api/hr/questions/sample-answers", headers=ORIGIN).json()
    assert st["filled"] > 0 and st["recompute"]["ready"] is True
    assert all(q["coverage"] >= 0.75 for q in st["questions"])

    r = client.post("/api/hr/questions/recompute", headers=ORIGIN)
    assert r.status_code == 200, r.text
    out = r.json()
    assert [q["status"] for q in out["questions"]] == ["active", "active"]
    assert all(len(q["oddsRatios"]) == 3 for q in out["questions"])
    res = out["result"]
    assert res["rescored"] == out["headcount"]
    assert res["intentAuc"]["withQuestions"] > res["intentAuc"]["baseOnly"]
    assert out["recompute"]["needed"] is False and out["recompute"]["last"] == res
    # Centred effects: the company-wide average barely moves.
    assert abs(_mean_risk() - before) < 0.03

    # A removed question stays in the scores until the next recompute, then leaves.
    first = out["questions"][0]["id"]
    st = client.delete(f"/api/hr/questions/{first}", headers=ORIGIN).json()
    assert st["questions"][0]["status"] == "removed"
    assert st["recompute"]["ready"] is True
    st = client.post("/api/hr/questions/recompute", headers=ORIGIN).json()
    assert [q["id"] for q in st["questions"]] == [out["questions"][1]["id"]]


def test_person_page_shows_added_answers_and_intent(client, seeded):
    _as_hr(client)
    client.post("/api/hr/questions", json={"questions": NEW[:1]}, headers=ORIGIN)
    client.post("/api/hr/questions/sample-answers", headers=ORIGIN)
    client.post("/api/hr/questions/recompute", headers=ORIGIN)
    with SessionLocal() as s:
        eid = s.scalars(select(Employee.employee_id).where(Employee.is_current)
                        .order_by(Employee.employee_id)).first()
        answered = questions.latest_answers(s, [eid]).get(eid)
    person = client.get(f"/api/hr/people/{eid}").json()
    if answered:
        assert person["addedQuestions"][0]["question"] == NEW[0]["label"]
        assert person["addedQuestions"][0]["oddsRatio"] > 0
    assert "stayIntent" in person


def test_pending_question_is_deleted_outright_and_limits_hold(client, seeded):
    _as_hr(client)
    st = client.post("/api/hr/questions", json={"questions": NEW[:1]}, headers=ORIGIN).json()
    qid = st["questions"][0]["id"]
    st = client.delete(f"/api/hr/questions/{qid}", headers=ORIGIN).json()
    assert st["questions"] == [] and st["recompute"]["needed"] is False
    assert client.delete(f"/api/hr/questions/{qid}", headers=ORIGIN).status_code == 404
    dup = {"label": "Pick one please", "options": ["Same", "same"]}
    assert client.post("/api/hr/questions", json={"questions": [dup]},
                       headers=ORIGIN).status_code == 422
    eleven = [{"label": f"Question number {i}", "options": ["A", "B"]} for i in range(11)]
    assert client.post("/api/hr/questions", json={"questions": eleven},
                       headers=ORIGIN).status_code == 422


def test_employees_cannot_manage_questions(client, seeded):
    _sign_in(client)
    assert client.get("/api/hr/questions").status_code == 403
    assert client.post("/api/hr/questions/recompute", headers=ORIGIN).status_code == 403


def test_reset_clears_questions_and_restores_scores(client, seeded):
    before = _mean_risk()
    _as_hr(client)
    client.post("/api/hr/questions", json={"questions": NEW}, headers=ORIGIN)
    client.post("/api/hr/questions/sample-answers", headers=ORIGIN)
    client.post("/api/hr/questions/recompute", headers=ORIGIN)
    with SessionLocal() as s:
        demo.reset(s, date.today())
        assert s.scalar(select(func.count()).select_from(CustomQuestion)) == 0
    assert abs(_mean_risk() - before) < 1e-6
