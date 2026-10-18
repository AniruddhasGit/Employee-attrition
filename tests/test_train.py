from ml.data import load_raw
from ml.evaluate import before_metrics


def test_no_test_rows_in_training(artifacts):
    assert artifacts["test_ids"] and artifacts["train_ids"]
    assert not set(artifacts["test_ids"]) & set(artifacts["train_ids"])
    assert len(artifacts["test_ids"]) + len(artifacts["train_ids"]) == 1470


def test_metrics_shape(artifacts):
    m = artifacts["metrics"]
    assert 0.5 < m["after"]["roc_auc"] <= 1
    assert 0 < m["threshold"] < 1
    assert m["before"]["accuracy"] > m["after"]["accuracy"]  # leakage inflates the old numbers
    for k, (lo, hi) in m["after"]["ci"].items():
        assert lo <= hi, k
    assert m["n_test_pos"] > 0
    assert len(m["threshold_curve"]) == 19 and m["calibration"]


def test_oof_covers_everyone(artifacts):
    oof = artifacts["oof"]
    assert len(oof) == 1470 and oof["EmployeeID"].is_unique
    assert oof["risk_score"].between(0, 1).all()
    assert set(oof["fold"]) == set(range(5))


def test_fold_and_refit_models_saved(artifacts):
    d = artifacts["dir"]
    assert all((d / f"fold_{k}.joblib").exists() for k in range(5))
    assert (d / "refit.joblib").exists()


def test_before_metrics_deterministic():
    df = load_raw()
    assert before_metrics(df) == before_metrics(df)
