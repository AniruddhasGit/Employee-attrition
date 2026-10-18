import pandas as pd

from ml.explain import PLAIN, top_drivers
from ml.features import FEATURES
from ml.paths import DEMO_CSV
from ml.score import score_frame


def test_plain_text_for_every_feature():
    assert set(PLAIN) == set(FEATURES)


def test_top_drivers_plain_english(fold_model_for, row_for):
    d = top_drivers(fold_model_for(1001), row_for(1001))
    assert len(d) == 5
    assert all(x["text"] and x["direction"] in {"raises", "lowers"} for x in d)
    assert not {x["feature"] for x in d} & {"Gender", "Age", "MaritalStatus"}
    assert set(x["feature"] for x in d) <= set(FEATURES)  # one-hot columns grouped back
    impacts = [abs(x["impact"]) for x in d]
    assert impacts == sorted(impacts, reverse=True)


def test_fairness_flags_small_groups(artifacts):
    s = artifacts["metrics"]["fairness"]
    assert {g["group"] for g in s} == {"Gender", "AgeBand", "MaritalStatus"}
    assert all(g["small_sample"] == (g["n"] < 30) for g in s)
    assert sum(g["n"] for g in s if g["group"] == "Gender") == 1470


def test_drivers_saved_for_everyone(artifacts):
    drivers = pd.read_parquet(artifacts["dir"] / "drivers.parquet")
    assert len(drivers) == 1470 and drivers["EmployeeID"].is_unique


def test_score_demo_csv(artifacts):
    p = score_frame(pd.read_csv(DEMO_CSV), artifacts["dir"] / "refit.joblib")
    assert len(p) == 20 and p.between(0, 1).all()


def test_artifacts_fit_free_hosting_budget(artifacts):
    total = sum(f.stat().st_size for f in artifacts["dir"].iterdir())
    assert total < 50 * 1024 * 1024


def test_demo_rows_are_flagged_as_training_rows():
    from ml.score import in_training

    flags = in_training(pd.read_csv(DEMO_CSV))
    assert len(flags) == 20 and flags.all()


def test_explainers_live_on_the_model_not_a_global_cache(fold_model_for, row_for):
    import ml.explain as explain

    model = fold_model_for(1001)
    top_drivers(model, row_for(1001))
    assert not hasattr(explain, "_explainers")
    assert len(model._retain_explainers) == len(model.calibrated_classifiers_)
