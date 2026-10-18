"""Loads the Phase A artifacts once and answers scoring questions."""

import json
from functools import lru_cache
from pathlib import Path

import joblib
import pandas as pd

from api.settings import get_settings
from ml.explain import top_drivers
from ml.features import FEATURES

ELEVATED_FRACTION = 0.6  # "elevated" starts at 60% of the decision threshold


class ModelService:
    def __init__(self, models_dir: Path):
        self.models_dir = Path(models_dir)
        self.metrics: dict = json.loads((self.models_dir / "metrics.json").read_text())
        self.threshold: float = float(self.metrics["threshold"])
        self._folds: dict[int, object] = {}

    def fold_model(self, k: int):
        if k not in self._folds:
            self._folds[k] = joblib.load(self.models_dir / f"fold_{k}.joblib")
        return self._folds[k]

    def band(self, p: float) -> str:
        if p >= self.threshold:
            return "high"
        if p >= self.threshold * ELEVATED_FRACTION:
            return "elevated"
        return "low"

    def score_row(self, features: dict, fold: int, overrides: dict | None = None):
        """Calibrated P(leave) and top drivers from the fold model that never saw this employee."""
        row = pd.DataFrame([{**features, **(overrides or {})}])[FEATURES]
        model = self.fold_model(fold)
        p = float(model.predict_proba(row)[0, 1])
        return p, top_drivers(model, row)


@lru_cache
def get_service() -> ModelService:
    return ModelService(get_settings().models_dir)
