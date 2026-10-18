import pytest

LEVERS = {"OverTime", "MonthlyIncome", "StockOptionLevel", "JobLevel",
          "TrainingTimesLastYear", "BusinessTravel", "YearsSinceLastPromotion"}


def test_summary_totals(client, seeded):
    s50 = client.get("/api/workforce/summary", params={"replacementPct": 50}).json()
    s100 = client.get("/api/workforce/summary", params={"replacementPct": 100}).json()
    assert s50["headcount"] == 1470 and s50["leavers"] == 237
    assert sum(b["count"] for b in s50["distribution"]) == 1470
    assert s100["expectedCost"] == pytest.approx(2 * s50["expectedCost"], rel=1e-9)
    assert 0 < s50["expectedLeavers"] < 1470
    cell = next(c for c in s50["heatmap"]
                if c["department"] == "Sales" and c["jobRole"] == "Sales Executive")
    assert cell["n"] > 0 and 0 <= cell["meanRisk"] <= 1
    assert s50["topDrivers"] and {"feature", "text", "share"} <= set(s50["topDrivers"][0])


def test_compare_segments(client, seeded):
    r = client.get("/api/workforce/compare", params={
        "a.department": "Sales", "b.department": "Research & Development"}).json()
    assert r["a"]["n"] + r["b"]["n"] < 1470 and r["a"]["n"] > 0 and r["b"]["n"] > 0
    assert r["a"]["label"] == "Sales" and "smallSample" in r["a"]


def test_compare_small_sample_flag(client, seeded):
    r = client.get("/api/workforce/compare", params={
        "a.jobRole": "Human Resources", "a.overTime": "Yes", "a.jobLevel": 3,
        "b.overTime": "No"}).json()
    assert r["a"]["smallSample"] is True and r["b"]["smallSample"] is False


def test_compare_rejects_unknown_filter_value(client, seeded):
    r = client.get("/api/workforce/compare", params={"a.overTime": "Maybe"})
    assert r.status_code == 422


def test_hypotheses_cover_levers(client):
    h = client.get("/api/hypotheses").json()
    assert LEVERS <= set(h)
    assert all(v["title"] and v["body"] for v in h.values())
    assert not any("$" in v["body"] for v in h.values())
