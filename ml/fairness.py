"""Performance by protected group. These columns never enter the model; they are audited here."""

import numpy as np
import pandas as pd
from sklearn.metrics import precision_score, recall_score

SMALL = 30


def age_band(age: pd.Series) -> pd.Series:
    return pd.cut(age, [0, 29, 39, 49, 200], labels=["<30", "30-39", "40-49", "50+"]).astype(str)


def slices(df: pd.DataFrame, oof: pd.DataFrame, threshold: float) -> list[dict]:
    data = df.merge(oof[["EmployeeID", "risk_score"]], on="EmployeeID")
    data["AgeBand"] = age_band(data["Age"])
    pred = (data["risk_score"] >= threshold).astype(int)
    out = []
    for group in ["Gender", "AgeBand", "MaritalStatus"]:
        for value, idx in data.groupby(group).groups.items():
            y, p = data.loc[idx, "Attrition"], pred.loc[idx]
            out.append({
                "group": group,
                "value": str(value),
                "n": int(len(idx)),
                "attrition_rate": round(float(y.mean()), 4),
                "mean_risk": round(float(data.loc[idx, "risk_score"].mean()), 4),
                "precision": round(float(precision_score(y, p, zero_division=0)), 4)
                if p.any() else None,
                "recall": round(float(recall_score(y, p, zero_division=0)), 4)
                if y.any() else None,
                "flag_rate": round(float(np.mean(p)), 4),
                "small_sample": bool(len(idx) < SMALL),
            })
    return out
