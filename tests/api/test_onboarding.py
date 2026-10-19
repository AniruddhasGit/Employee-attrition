from datetime import date

from sqlalchemy import select

from api import demo
from api.db import SessionLocal
from api.models import Employee, User
from tests.api.conftest import ORIGIN, login

NEW = {"name": "Alex Morgan", "email": "Alex.Morgan@Example.com", "password": "temp-pass-1",
       "department": "Sales", "jobRole": "Sales Executive", "jobLevel": 2,
       "monthlyIncome": 5200, "yearsAtCompany": 0, "overTime": "No",
       "businessTravel": "Travel_Rarely"}


def _as_hr(client, make_user):
    hr = make_user("hr")
    assert login(client, hr.email).status_code == 200


def _add(client, **change):
    return client.post("/api/hr/people", json={**NEW, **change}, headers=ORIGIN)


def test_hr_adds_a_scored_person_who_must_set_a_password(client, make_user, seeded):
    _as_hr(client, make_user)
    roles = client.get("/api/hr/roles").json()["departments"]
    assert {"department": "Sales", "roles": ["Manager", "Sales Executive",
                                             "Sales Representative"]} in roles

    r = _add(client)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["email"] == "alex.morgan@example.com"
    assert 0 < body["riskScore"] < 1
    person = client.get(f"/api/hr/people/{body['id']}").json()
    assert person["name"] == "Alex Morgan" and person["jobRole"] == "Sales Executive"
    assert person["checkIns"] == [] and person["drivers"]
    with SessionLocal() as s:
        e = s.get(Employee, body["id"])
        assert e.added_by_hr and e.features["YearsInCurrentRole"] == 0
        u = s.scalars(select(User).where(User.employee_id == body["id"])).one()
        assert u.must_change_password and u.role == "employee"

    client.cookies.clear()
    r = login(client, "alex.morgan@example.com", "temp-pass-1")
    assert r.json() == {"role": "employee", "displayName": "Alex Morgan", "home": "/welcome",
                        "mustChangePassword": True}
    assert client.get("/api/me").status_code == 403
    assert client.post("/api/auth/password", json={"password": "short"},
                       headers=ORIGIN).status_code == 422
    assert client.post("/api/auth/password", json={"password": "temp-pass-1xx"},
                       headers=ORIGIN).status_code == 200
    assert client.get("/api/auth/me").json()["home"] == "/me"
    assert client.get("/api/me").status_code == 200
    assert client.post("/api/auth/password", json={"password": "another-pass-2"},
                       headers=ORIGIN).status_code == 409

    client.cookies.clear()
    assert login(client, "alex.morgan@example.com", "temp-pass-1").status_code == 401
    assert login(client, "alex.morgan@example.com", "temp-pass-1xx").json()["home"] == "/me"


def test_new_password_must_differ_from_the_temporary_one(client, make_user, seeded):
    _as_hr(client, make_user)
    _add(client, email="same@example.com")
    client.cookies.clear()
    login(client, "same@example.com", "temp-pass-1")
    r = client.post("/api/auth/password", json={"password": "temp-pass-1"}, headers=ORIGIN)
    assert r.status_code == 400
    assert r.json()["detail"] == "Pick a password different from the temporary one."


def test_add_person_rejects_duplicates_bad_roles_and_non_hr(client, make_user, seeded):
    _as_hr(client, make_user)
    assert _add(client, email="dup@example.com").status_code == 201
    assert _add(client, email="DUP@example.com").status_code == 409
    assert _add(client, email="x@example.com", jobRole="Research Scientist").status_code == 422
    assert _add(client, email="not-an-email").status_code == 422
    client.cookies.clear()
    emp = make_user("employee", employee_id=1004)
    login(client, emp.email)
    assert _add(client, email="y@example.com").status_code == 403


def test_daily_reset_removes_added_people(client, make_user, seeded):
    _as_hr(client, make_user)
    new_id = _add(client, email="gone@example.com").json()["id"]
    with SessionLocal() as s:
        demo.reset(s, date.today())
        assert s.get(Employee, new_id) is None
        assert s.scalars(select(User).where(User.email == "gone@example.com")).first() is None


def test_startup_password_sync_leaves_added_people_alone(client, make_user, seeded):
    _as_hr(client, make_user)
    _add(client, email="keep@retain.demo")
    with SessionLocal() as s:
        demo.sync_passwords(s)
    client.cookies.clear()
    assert login(client, "keep@retain.demo", "temp-pass-1").status_code == 200
