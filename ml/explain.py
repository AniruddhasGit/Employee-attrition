"""SHAP drivers, grouped back to the original columns and written in plain English."""

from collections.abc import Callable

import numpy as np
import pandas as pd
import shap

from ml.features import CATEGORICAL, FEATURES

LEVEL4 = {1: "low", 2: "medium", 3: "high", 4: "very high"}
EDUCATION = {1: "below college", 2: "college", 3: "bachelor's", 4: "master's", 5: "doctorate"}
BALANCE = {1: "bad", 2: "good", 3: "better", 4: "best"}


def _years(label: str) -> Callable[[object], str]:
    return lambda v: f"{label}: {int(v)} year{'s' if int(v) != 1 else ''}"


PLAIN: dict[str, Callable[[object], str]] = {
    "BusinessTravel": lambda v: {
        "Travel_Frequently": "Travels frequently for work",
        "Travel_Rarely": "Travels rarely for work",
        "Non-Travel": "Does not travel for work",
    }.get(v, f"Business travel: {v}"),
    "Department": lambda v: f"Works in {v}",
    "EducationField": lambda v: f"Education field: {v}",
    "JobRole": lambda v: f"Role: {v}",
    "OverTime": lambda v: "Works overtime" if v == "Yes" else "No overtime",
    "DailyRate": lambda v: f"Daily rate {int(v):,}",
    "DistanceFromHome": lambda v: f"Lives {int(v)} km from work",
    "Education": lambda v: f"Education: {EDUCATION.get(int(v), v)}",
    "EnvironmentSatisfaction": lambda v: f"Workplace satisfaction: {LEVEL4.get(int(v), v)}",
    "HourlyRate": lambda v: f"Hourly rate {int(v)}",
    "JobInvolvement": lambda v: f"Job involvement: {LEVEL4.get(int(v), v)}",
    "JobLevel": lambda v: f"Job level {int(v)} of 5",
    "JobSatisfaction": lambda v: f"Job satisfaction: {LEVEL4.get(int(v), v)}",
    "MonthlyIncome": lambda v: f"Earns {int(v):,} a month",
    "MonthlyRate": lambda v: f"Monthly rate {int(v):,}",
    "NumCompaniesWorked": lambda v: f"Has worked at {int(v)} other compan"
    f"{'y' if int(v) == 1 else 'ies'}",
    "PercentSalaryHike": lambda v: f"Last raise: {int(v)}%",
    "PerformanceRating": lambda v: f"Performance rating: {LEVEL4.get(int(v), v)}",
    "RelationshipSatisfaction": lambda v: f"Relationship satisfaction: {LEVEL4.get(int(v), v)}",
    "StockOptionLevel": lambda v: "No stock options" if int(v) == 0
    else f"Stock option level {int(v)}",
    "TotalWorkingYears": _years("Career length"),
    "TrainingTimesLastYear": lambda v: f"{int(v)} training sessions last year",
    "WorkLifeBalance": lambda v: f"Work-life balance: {BALANCE.get(int(v), v)}",
    "YearsAtCompany": _years("Time at company"),
    "YearsInCurrentRole": _years("Time in current role"),
    "YearsSinceLastPromotion": _years("Since last promotion"),
    "YearsWithCurrManager": _years("Time with current manager"),
}

_explainers: dict[int, list[tuple]] = {}


def _parts(model) -> list[tuple]:
    """(encoder, TreeExplainer) for each inner model of the calibrated ensemble, built once."""
    key = id(model)
    if key not in _explainers:
        _explainers[key] = [
            (cc.estimator["enc"], shap.TreeExplainer(cc.estimator["xgb"]))
            for cc in model.calibrated_classifiers_
        ]
    return _explainers[key]


def _origin(name: str) -> str:
    for col in CATEGORICAL:
        if name.startswith(col + "_"):
            return col
    return name


def shap_by_feature(model, X: pd.DataFrame) -> pd.DataFrame:
    """Signed SHAP (log-odds) per original column, averaged over the ensemble's inner models."""
    total = None
    for enc, explainer in _parts(model):
        values = explainer.shap_values(enc.transform(X[FEATURES]))
        frame = pd.DataFrame(values, columns=enc.get_feature_names_out(), index=X.index)
        grouped = frame.T.groupby(_origin).sum().T
        total = grouped if total is None else total + grouped
    return (total / len(_parts(model)))[FEATURES]


def drivers_from_shap(row: pd.Series, impacts: pd.Series, k: int = 5) -> list[dict]:
    top = impacts.reindex(impacts.abs().sort_values(ascending=False).index).head(k)
    out = []
    for feature, impact in top.items():
        value = row[feature]
        out.append({
            "feature": feature,
            "value": value.item() if isinstance(value, np.generic) else value,
            "impact": round(float(impact), 4),
            "direction": "raises" if impact > 0 else "lowers",
            "text": PLAIN[feature](value),
        })
    return out


def top_drivers(model, row: pd.DataFrame, k: int = 5) -> list[dict]:
    impacts = shap_by_feature(model, row).iloc[0]
    return drivers_from_shap(row[FEATURES].iloc[0], impacts, k)
