"""Train, evaluate honestly, and write every artifact the app needs.  Run: python -m ml.train"""

import json
from datetime import UTC, datetime
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.base import clone
from sklearn.model_selection import StratifiedKFold, train_test_split

from ml.data import load_raw
from ml.evaluate import (
    SCALARS,
    before_metrics,
    best_f1_threshold,
    bootstrap_ci,
    calibration,
    metrics_at,
    threshold_curve,
)
from ml.features import split_X_y
from ml.model import RANDOM_STATE, build_pipeline
from ml.paths import MODELS_DIR

VERSION = "1.0.0"
N_FOLDS = 5


def _oof(X: pd.DataFrame, y: pd.Series, save_dir: Path | None = None):
    """Out-of-fold probabilities: every row is scored by a model that never saw it."""
    proba = np.zeros(len(y))
    fold = np.zeros(len(y), dtype=int)
    skf = StratifiedKFold(N_FOLDS, shuffle=True, random_state=RANDOM_STATE)
    for k, (tr, te) in enumerate(skf.split(X, y)):
        model = clone(build_pipeline()).fit(X.iloc[tr], y.iloc[tr])
        proba[te] = model.predict_proba(X.iloc[te])[:, 1]
        fold[te] = k
        if save_dir is not None:
            joblib.dump(model, save_dir / f"fold_{k}.joblib", compress=3)
    return proba, fold


def main(out_dir: Path = MODELS_DIR, n_boot: int = 1000) -> dict:
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    df = load_raw()
    X, y = split_X_y(df)

    # 1. Held-out evaluation: threshold picked on train OOF, metrics on the untouched test set.
    X_tr, X_te, y_tr, y_te, id_tr, id_te = train_test_split(
        X, y, df["EmployeeID"], test_size=0.2, stratify=y, random_state=RANDOM_STATE
    )
    oof_tr, _ = _oof(X_tr, y_tr)
    threshold = best_f1_threshold(y_tr.to_numpy(), oof_tr)
    p_te = build_pipeline().fit(X_tr, y_tr).predict_proba(X_te)[:, 1]
    after = metrics_at(y_te, p_te, threshold)
    after["ci"] = bootstrap_ci(y_te, p_te, threshold, n=n_boot)

    # 2. Site scores: OOF over everyone (fold models kept for the what-if simulator) + full refit.
    oof_all, fold_all = _oof(X, y, save_dir=out_dir)
    joblib.dump(build_pipeline().fit(X, y), out_dir / "refit.joblib", compress=3)
    oof = pd.DataFrame({"EmployeeID": df["EmployeeID"], "fold": fold_all, "risk_score": oof_all})
    oof.to_parquet(out_dir / "oof.parquet", index=False)

    metrics = {
        "version": VERSION,
        "created_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "threshold": round(threshold, 4),
        "n_test": int(len(y_te)),
        "n_test_pos": int(y_te.sum()),
        "before": before_metrics(df),
        "after": after,
        "threshold_curve": threshold_curve(y_te, p_te),
        "calibration": calibration(y_te, p_te),
        "oof_all": metrics_at(y, oof_all, threshold),
    }
    (out_dir / "metrics.json").write_text(json.dumps(metrics, indent=2))
    (out_dir / "test_ids.json").write_text(json.dumps(id_te.tolist()))
    (out_dir / "train_ids.json").write_text(json.dumps(id_tr.tolist()))
    return metrics


def report(m: dict) -> str:
    lines = [
        f"Retain model v{m['version']}  threshold={m['threshold']}  "
        f"test n={m['n_test']} (leavers={m['n_test_pos']})",
        f"{'metric':<10}{'before (leaky)':>16}{'after (held-out)':>18}   95% CI",
    ]
    for k in SCALARS:
        lo, hi = m["after"]["ci"][k]
        lines.append(f"{k:<10}{m['before'][k]:>16.3f}{m['after'][k]:>18.3f}   [{lo:.3f}, {hi:.3f}]")
    return "\n".join(lines)


if __name__ == "__main__":
    print(report(main()))
