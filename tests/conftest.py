import json

import pandas as pd
import pytest


@pytest.fixture(scope="session")
def artifacts(tmp_path_factory):
    """Run the full training pipeline once into a temp dir (fewer bootstrap draws for speed)."""
    from ml.train import main

    out = tmp_path_factory.mktemp("models")
    main(out_dir=out, n_boot=50)
    return {
        "dir": out,
        "metrics": json.loads((out / "metrics.json").read_text()),
        "test_ids": json.loads((out / "test_ids.json").read_text()),
        "train_ids": json.loads((out / "train_ids.json").read_text()),
        "oof": pd.read_parquet(out / "oof.parquet"),
    }


@pytest.fixture(scope="session")
def fold_model_for(artifacts):
    import joblib

    oof = artifacts["oof"].set_index("EmployeeID")
    cache = {}

    def get(emp_id: int):
        k = int(oof.loc[emp_id, "fold"])
        if k not in cache:
            cache[k] = joblib.load(artifacts["dir"] / f"fold_{k}.joblib")
        return cache[k]

    return get


@pytest.fixture(scope="session")
def row_for():
    from ml.data import load_raw
    from ml.features import FEATURES

    df = load_raw().set_index("EmployeeID")
    return lambda emp_id: df.loc[[emp_id], FEATURES]
