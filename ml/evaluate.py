import numpy as np
import pandas as pd
from imblearn.over_sampling import SMOTE
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    brier_score_loss,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from xgboost import XGBClassifier

from ml.model import BASELINE_PARAMS, RANDOM_STATE

SCALARS = ["roc_auc", "pr_auc", "precision", "recall", "f1", "accuracy", "brier"]


def _scalars(y, p, threshold: float) -> dict:
    y, p = np.asarray(y), np.asarray(p)
    pred = (p >= threshold).astype(int)
    return {
        "roc_auc": roc_auc_score(y, p),
        "pr_auc": average_precision_score(y, p),
        "precision": precision_score(y, pred, zero_division=0),
        "recall": recall_score(y, pred, zero_division=0),
        "f1": f1_score(y, pred, zero_division=0),
        "accuracy": accuracy_score(y, pred),
        "brier": brier_score_loss(y, p),
    }


def metrics_at(y_true, proba, threshold: float) -> dict:
    out = {k: round(float(v), 4) for k, v in _scalars(y_true, proba, threshold).items()}
    pred = (np.asarray(proba) >= threshold).astype(int)
    out["confusion"] = confusion_matrix(y_true, pred, labels=[0, 1]).tolist()
    out["threshold"] = round(float(threshold), 4)
    return out


def bootstrap_ci(y_true, proba, threshold: float, n: int = 1000, seed: int = RANDOM_STATE) -> dict:
    """95% percentile bootstrap CI per scalar metric (resamples rows with replacement)."""
    y, p = np.asarray(y_true), np.asarray(proba)
    rng = np.random.default_rng(seed)
    draws = {k: [] for k in SCALARS}
    for _ in range(n):
        idx = rng.integers(0, len(y), len(y))
        if y[idx].min() == y[idx].max():
            continue  # AUC is undefined without both classes
        for k, v in _scalars(y[idx], p[idx], threshold).items():
            draws[k].append(v)
    return {
        k: [round(float(np.percentile(v, 2.5)), 4), round(float(np.percentile(v, 97.5)), 4)]
        for k, v in draws.items()
    }


def before_metrics(df: pd.DataFrame) -> dict:
    """Reproduce the original notebook exactly: every column, SMOTE on all rows, fit on all rows,
    then score those same rows at the hard-coded 0.9 threshold (in-sample, so leaky)."""
    X = pd.get_dummies(df.drop(columns=["Attrition", "EmployeeID"]), drop_first=True)
    y = df["Attrition"]
    X_bal, y_bal = SMOTE(random_state=RANDOM_STATE).fit_resample(X, y)
    model = XGBClassifier(**BASELINE_PARAMS).fit(X_bal, y_bal)
    return metrics_at(y, model.predict_proba(X)[:, 1], 0.9)


def threshold_curve(y_true, proba) -> list[dict]:
    rows = []
    for t in np.round(np.arange(0.05, 0.951, 0.05), 2):
        s = _scalars(y_true, proba, t)
        rows.append({
            "threshold": float(t),
            **{k: round(float(s[k]), 4) for k in ("precision", "recall", "f1")},
        })
    return rows


def calibration(y_true, proba, bins: int = 10) -> list[dict]:
    y, p = np.asarray(y_true), np.asarray(proba)
    edges = np.linspace(0, 1, bins + 1)
    out = []
    for lo, hi in zip(edges[:-1], edges[1:], strict=True):
        mask = (p >= lo) & ((p < hi) if hi < 1 else (p <= hi))
        if mask.any():
            out.append({
                "mean_pred": round(float(p[mask].mean()), 4),
                "frac_pos": round(float(y[mask].mean()), 4),
                "n": int(mask.sum()),
            })
    return out


def best_f1_threshold(y_true, proba) -> float:
    proba = np.asarray(proba)
    candidates = np.unique(np.round(proba, 4))
    scores = [f1_score(y_true, (proba >= t).astype(int), zero_division=0) for t in candidates]
    return float(candidates[int(np.argmax(scores))])
