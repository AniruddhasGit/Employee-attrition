from pathlib import Path

import joblib
import pandas as pd

from ml.features import FEATURES
from ml.paths import MODELS_DIR


def score_frame(df: pd.DataFrame, model_path: Path = MODELS_DIR / "refit.joblib") -> pd.Series:
    """P(leave) for rows outside the training data. Extra columns (incl. protected) are ignored."""
    model = joblib.load(model_path)
    return pd.Series(model.predict_proba(df[FEATURES])[:, 1], index=df.index, name="risk_score")
