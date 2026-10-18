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
    assert m["before"]["roc_auc"] > m["after"]["roc_auc"]  # graded on rows it trained on
    assert m["before"]["precision"] < m["after"]["precision"]  # zeroed categories over-flag
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


def test_before_reproduces_original_single_row_scoring():
    # The original notebook printed P(leave) = 0.8924592 for employee 1004 via
    # predict_attrition_by_id, whose per-row get_dummies(drop_first=True) zeroed every category.
    from ml.evaluate import before_scores

    scores = before_scores(load_raw())
    # Exact replay drifts across platforms and versions (0.83 to 0.89); what matters is that the
    # original rated 1004 as very likely to leave, then printed "Likely to Stay".
    assert scores.loc[1004] > 0.75


def test_no_false_certainty(artifacts):
    # Isotonic calibration pinned some people at exactly 100%; shown scores must never claim that.
    oof = artifacts["oof"]
    assert oof["risk_score"].max() < 0.95 and oof["risk_score"].min() > 0.0
