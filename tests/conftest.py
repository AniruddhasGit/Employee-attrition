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
