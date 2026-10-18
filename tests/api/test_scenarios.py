def test_scenario_roundtrip(client, seeded):
    r = client.post("/api/scenarios", json={"employeeId": 1004, "levers": {"overTime": "No"}})
    assert r.status_code == 201
    pid = r.json()["publicId"]
    assert len(pid) >= 8
    s = client.get(f"/api/scenarios/{pid}").json()
    assert s["employee"]["id"] == 1004 and s["levers"]["overTime"] == "No"
    assert s["after"] < s["before"] and abs(s["delta"] - (s["after"] - s["before"])) < 1e-6


def test_scenario_ignores_client_numbers(client, seeded):
    r = client.post("/api/scenarios", json={"employeeId": 1004, "levers": {}, "before": 0.0,
                                            "after": 0.99})
    s = client.get(f"/api/scenarios/{r.json()['publicId']}").json()
    assert s["after"] == s["before"] and s["after"] != 0.99


def test_scenario_unknown_404(client, seeded):
    assert client.get("/api/scenarios/doesnotexist").status_code == 404
