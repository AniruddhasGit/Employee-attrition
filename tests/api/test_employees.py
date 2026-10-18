PROTECTED = {"gender", "age", "maritalStatus", "Gender", "Age", "MaritalStatus"}


def test_list_filters_and_sorts(client, seeded):
    from api.service import get_service

    r = client.get("/api/employees", params={"band": "high", "sort": "risk", "limit": 50})
    body = r.json()
    assert r.status_code == 200 and body["total"] > 0
    scores = [e["riskScore"] for e in body["items"]]
    assert all(s >= get_service().threshold for s in scores)
    assert scores == sorted(scores, reverse=True)


def test_list_filters_by_department(client, seeded):
    items = client.get("/api/employees", params={"department": "Sales"}).json()["items"]
    assert items and all(e["department"] == "Sales" for e in items)


def test_card_has_no_protected_fields(client, seeded):
    card = client.get("/api/employees/1004").json()
    assert not PROTECTED & set(card)
    assert not PROTECTED & set(card["levers"])
    assert card["levers"]["overTime"] == "Yes"
    assert {"feature", "value", "impact", "direction", "text"} <= set(card["drivers"][0])


def test_random_employee_respects_band(client, seeded):
    assert client.get("/api/employees/random", params={"band": "high"}).json()["riskBand"] == "high"


def test_simulate_noop_matches_stored(client, seeded):
    stored = client.get("/api/employees/1004").json()["riskScore"]
    r = client.post("/api/simulate", json={"employeeId": 1004, "levers": {}}).json()
    assert abs(r["before"] - stored) < 1e-6 and abs(r["after"] - stored) < 1e-6 and r["delta"] == 0


def test_simulate_overtime_off_lowers_risk_for_1004(client, seeded):
    r = client.post("/api/simulate", json={"employeeId": 1004, "levers": {"overTime": "No"}}).json()
    assert r["after"] < r["before"] and r["delta"] < 0
    assert r["afterBand"] in {"low", "elevated", "high"} and len(r["drivers"]) == 5


def test_simulate_unknown_employee_404(client, seeded):
    r = client.post("/api/simulate", json={"employeeId": 99, "levers": {}})
    assert r.status_code == 404 and "not found" in r.json()["detail"].lower()


def test_simulate_out_of_range_422(client, seeded):
    r = client.post("/api/simulate", json={"employeeId": 1004, "levers": {"monthlyIncome": 999999}})
    assert r.status_code == 422
