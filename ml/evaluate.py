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


def before_scores(df: pd.DataFrame) -> pd.Series:
    """Re-run the original notebook's predictor on every employee, bugs included.

    It used every column (protected ones too), applied SMOTE to all rows, fitted on all rows
    with default n_jobs, and then scored the same rows one at a time. Its per-row
    get_dummies(drop_first=True) drops the only dummy of each category, so after reindexing
    every categorical feature (overtime, job role, ...) reached the model as 0.
    """
    X = pd.get_dummies(df.drop(columns=["Attrition", "EmployeeID"]), drop_first=True)
    y = df["Attrition"]
    X_bal, y_bal = SMOTE(random_state=RANDOM_STATE).fit_resample(X, y)
    params = {k: v for k, v in BASELINE_PARAMS.items() if k != "n_jobs"}
    model = XGBClassifier(**params).fit(X_bal, y_bal)
    dummies = [c for c in X.columns if X[c].dtype == bool]
    X_as_scored = X.copy()
    X_as_scored[dummies] = False
    return pd.Series(model.predict_proba(X_as_scored)[:, 1], index=df["EmployeeID"])


def before_metrics(df: pd.DataFrame) -> dict:
    """What the original notebook would have reported had it measured itself: its own predictor,
    on the rows it was trained on, at its hard-coded 0.9 cut-off. It never printed these."""
    return metrics_at(df["Attrition"], before_scores(df).to_numpy(), 0.9)


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
