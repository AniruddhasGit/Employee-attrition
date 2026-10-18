from pathlib import Path

import joblib
import pandas as pd

from ml.data import load_raw
from ml.features import FEATURES
from ml.paths import MODELS_DIR


def score_frame(df: pd.DataFrame, model_path: Path = MODELS_DIR / "refit.joblib") -> pd.Series:
    """P(leave) from the model refit on all rows. Extra columns (incl. protected) are ignored.

    Only out-of-sample if the rows are not in the dataset; check with `in_training` first.
    """
    model = joblib.load(model_path)
    return pd.Series(model.predict_proba(df[FEATURES])[:, 1], index=df.index, name="risk_score")


def in_training(df: pd.DataFrame) -> pd.Series:
    """True where a row's features exactly match an employee the refit model was trained on."""
    known = set(map(tuple, load_raw()[FEATURES].astype(str).to_numpy()))
    keys = map(tuple, df[FEATURES].astype(str).to_numpy())
    return pd.Series([k in known for k in keys], index=df.index, name="in_training")
