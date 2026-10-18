from datetime import date

from sqlalchemy import select

from api import demo
from api.db import SessionLocal
from api.models import ActionPlan, Employee
from api.quarters import quarter_of
from tests.api.conftest import login

HR_GETS = ["/api/hr/dashboard", "/api/hr/people", "/api/hr/people/1004", "/api/hr/check-ins"]


def _persona(story):
    with SessionLocal() as s:
        return next(p for p in demo.personas(s) if p["story"] == story)


def _as(client, story):
    p = _persona(story)
    client.cookies.clear()
    assert login(client, p["email"], "retain-demo").status_code == 200
    return p


def test_role_gates(client, seeded):
    for url in HR_GETS:
        assert client.get(url).status_code == 401, url
    assert client.post("/api/hr/simulate", json={"employeeId": 1004, "levers": {}}).status_code \
        == 401
    _as(client, "stable")
    for url in HR_GETS:
        assert client.get(url).status_code == 403, url
    assert client.post("/api/hr/updates", json={"department": "Sales", "said": "a",
                                                "did": "b"}).status_code == 403
    _as(client, "hr")
    assert client.get("/api/me").status_code == 403
    assert client.get("/api/me/check-in").status_code == 403


def test_dashboard_numbers(client, seeded):
    _as(client, "hr")
    d = client.get("/api/hr/dashboard", params={"replacementPct": 50}).json()
    assert d["headcount"] == 1233 and d["quarter"] == quarter_of(date.today())
    with SessionLocal() as s:
        high = s.scalars(select(Employee).where(Employee.is_current,
                                                Employee.risk_band == "high")).all()
    assert d["highRisk"] == len(high)
    assert abs(d["costAtStake"] - sum(e.monthly_income * 12 * 0.5 for e in high)) < 1
    doubled = client.get("/api/hr/dashboard", params={"replacementPct": 100}).json()
    assert abs(doubled["costAtStake"] - 2 * d["costAtStake"]) < 1
    assert 0.6 <= d["responseRate"] <= 0.7
    for theme in d["keepThemes"]:
        assert theme["hidden"] == (theme["n"] < 5)
        assert (theme["top"] == []) == theme["hidden"]
    assert 0.5 < d["trust"]["rocAuc"] < 1 and d["trust"]["fairness"]
    assert {"department", "jobRole", "n", "meanRisk", "expectedCost"} <= set(d["heatmap"][0])


def test_sharp_drop_persona_listed(client, seeded):
    p = _as(client, "hr") and _persona("sharp_drop")
    drops = client.get("/api/hr/dashboard").json()["sharpDrops"]
    hit = next(x for x in drops if x["id"] == p["employee_id"])
    assert hit["name"] == p["display_name"] and hit["fields"]
    assert {"column", "label", "from", "to"} <= set(hit["fields"][0])


def test_person_page_contents(client, seeded):
    _as(client, "hr")
    p = _persona("plan_worked")
    body = client.get(f"/api/hr/people/{p['employee_id']}").json()
    assert body["name"] == p["display_name"] and len(body["riskHistory"]) == 4
    plan = next(x for x in body["plans"] if x["action"] == "pay_review")
    assert plan["status"] == "done" and plan["actualChange"] < 0
    assert plan["label"] == "Pay review"
    assert body["checkIns"][-1]["quarter"] == quarter_of(date.today())
    assert body["change"].startswith("Risk ")
    assert {"overTime", "monthlyIncome"} <= set(body["levers"])
    assert len(body["drivers"]) == 5


def test_former_staff_404(client, seeded):
    _as(client, "hr")
    with SessionLocal() as s:
        gone = s.scalars(select(Employee.employee_id).where(~Employee.is_current)).first()
    assert client.get(f"/api/hr/people/{gone}").status_code == 404
    assert client.get("/api/hr/people/999999").status_code == 404
    people = client.get("/api/hr/people", params={"limit": 2000}).json()
    assert people["total"] == 1233 and gone not in {x["id"] for x in people["items"]}


def test_plan_done_applies_lever(client, seeded):
    _as(client, "hr")
    p = _persona("sharp_drop")
    eid = p["employee_id"]
    before = client.get(f"/api/hr/people/{eid}").json()
    made = client.post(f"/api/hr/people/{eid}/plans", json={"action": "pay_review",
                                                            "note": "Market check"})
    assert made.status_code == 201
    plan = made.json()
    assert plan["status"] == "open" and plan["estimatedScore"] != plan["scoreAtCreation"]
    assert plan["actualChange"] is None
    done = client.patch(f"/api/hr/plans/{plan['id']}", json={"status": "done"})
    assert done.status_code == 200 and done.json()["status"] == "done"
    with SessionLocal() as s:
        e = s.get(Employee, eid)
        assert e.record["MonthlyIncome"] == round(before["monthlyIncome"] * 1.1)
    after = client.get(f"/api/hr/people/{eid}").json()
    assert after["riskScore"] != before["riskScore"]


def test_reduce_overtime_done_beats_older_checkin(client, seeded):
    """A plan finished after the latest check-in changes today's score at once."""
    _as(client, "hr")
    eid = _persona("sharp_drop")["employee_id"]
    assert client.get(f"/api/hr/people/{eid}").json()["levers"]["overTime"] == "Yes"
    plan = client.post(f"/api/hr/people/{eid}/plans", json={"action": "reduce_overtime"}).json()
    client.patch(f"/api/hr/plans/{plan['id']}", json={"status": "done"})
    assert client.get(f"/api/hr/people/{eid}").json()["levers"]["overTime"] == "No"


def test_plan_validation(client, seeded):
    _as(client, "hr")
    eid = _persona("sharp_drop")["employee_id"]
    assert client.post(f"/api/hr/people/{eid}/plans", json={"action": "free_lunch"}) \
        .status_code == 422
    assert client.post(f"/api/hr/people/{eid}/plans", json={"action": "pay_review",
                                                            "note": "x" * 301}).status_code == 422
    assert client.patch("/api/hr/plans/999999", json={"status": "done"}).status_code == 404


def test_checkins_page_and_updates(client, seeded):
    _as(client, "hr")
    p = _persona("not_answered")
    body = client.get("/api/hr/check-ins").json()
    assert p["employee_id"] in {m["id"] for m in body["missing"]}
    assert sum(d["total"] for d in body["byDepartment"]) == 1233
    with SessionLocal() as s:
        dept = s.get(Employee, p["employee_id"]).department
    made = client.post("/api/hr/updates", json={"department": dept, "said": "More flexibility",
                                                "did": "Core hours are now 10 to 3."})
    assert made.status_code == 201
    assert client.get("/api/hr/check-ins").json()["updates"][0]["said"] == "More flexibility"
    _as(client, "not_answered")
    assert client.get("/api/me").json()["updates"][0]["did"] == "Core hours are now 10 to 3."


def test_update_validation(client, seeded):
    _as(client, "hr")
    assert client.post("/api/hr/updates", json={"department": "Sales", "said": "x" * 281,
                                                "did": "ok"}).status_code == 422
    assert client.post("/api/hr/updates", json={"department": "Space", "said": "a",
                                                "did": "b"}).status_code == 422


def test_people_search(client, seeded):
    _as(client, "hr")
    p = _persona("stable")
    surname = p["display_name"].split()[-1]
    items = client.get("/api/hr/people", params={"search": surname}).json()["items"]
    assert p["employee_id"] in {x["id"] for x in items}
    assert all(surname.lower() in x["name"].lower() for x in items)
    first = client.get("/api/hr/people", params={"limit": 5}).json()["items"]
    assert [x["riskScore"] for x in first] == sorted((x["riskScore"] for x in first),
                                                     reverse=True)
    assert {"trend", "answered", "riskBand"} <= set(first[0])


def test_simulate_starts_from_current_inputs(client, seeded):
    _as(client, "hr")
    eid = _persona("sharp_drop")["employee_id"]
    r = client.post("/api/hr/simulate", json={"employeeId": eid, "levers": {"overTime": "No"}})
    assert r.status_code == 200
    with SessionLocal() as s:
        assert abs(r.json()["before"] - s.get(Employee, eid).risk_score) < 1e-9


def test_seeded_plans_untouched_after_teardown(seeded):
    with SessionLocal() as s:
        assert all(p.status == p.seed_snapshot["status"]
                   for p in s.scalars(select(ActionPlan).where(ActionPlan.seeded)))
