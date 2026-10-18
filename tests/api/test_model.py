def test_metrics_endpoint(client, seeded):
    m = client.get("/api/model/metrics").json()
    assert 0.5 < m["after"]["roc_auc"] < m["before"]["roc_auc"] <= 1
    assert {"version", "threshold", "nTest", "nTestPos", "before", "after",
            "thresholdCurve", "calibration", "fairness"} <= set(m)
    assert len(m["thresholdCurve"]) == 19
