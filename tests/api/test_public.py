def test_public_summary_is_aggregate_only(client, seeded):
    body = client.get("/api/public/summary").json()
    assert set(body) == {"metrics", "riskiest", "overtime", "topDriver"}
    assert {"roc_auc", "recall"} <= set(body["metrics"]["after"])
    assert body["riskiest"]["n"] >= 10 and 0 < body["riskiest"]["meanRisk"] < 1
    assert 0 <= body["overtime"]["yes"] <= 1 and 0 <= body["overtime"]["no"] <= 1
    assert 0 < body["topDriver"]["share"] <= 1 and body["topDriver"]["text"]
    text = str(body)
    assert "name" not in text and "employeeId" not in text
