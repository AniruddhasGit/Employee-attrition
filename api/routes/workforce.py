from collections import Counter
from typing import Literal

import numpy as np
import pandas as pd
from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import Field, ValidationError
from sqlalchemy import select

from api.content import FEATURE_LABELS, HYPOTHESES
from api.db import SessionDep
from api.models import Employee
from api.schemas import CamelModel

router = APIRouter(prefix="/api")

SMALL_SEGMENT = 10
BIN = 0.05


class Segment(CamelModel):
    department: str | None = None
    job_role: str | None = None
    over_time: Literal["Yes", "No"] | None = None
    job_level: int | None = Field(None, ge=1, le=5)

    def label(self) -> str:
        parts = [self.department, self.job_role,
                 f"Overtime: {self.over_time}" if self.over_time else None,
                 f"Level {self.job_level}" if self.job_level else None]
        return " · ".join(p for p in parts if p) or "Everyone"

    def mask(self, df: pd.DataFrame) -> pd.Series:
        m = pd.Series(True, index=df.index)
        for col, val in [("department", self.department), ("job_role", self.job_role),
                         ("overtime", self.over_time), ("job_level", self.job_level)]:
            if val is not None:
                m &= df[col] == val
        return m


def _frame(session) -> pd.DataFrame:
    rows = session.execute(select(
        Employee.department, Employee.job_role, Employee.job_level, Employee.overtime,
        Employee.monthly_income, Employee.risk_score, Employee.attrition, Employee.drivers,
    )).all()
    return pd.DataFrame(rows, columns=["department", "job_role", "job_level", "overtime",
                                       "monthly_income", "risk_score", "attrition", "drivers"])


def _cost(df: pd.DataFrame, pct: float) -> float:
    return float((df["risk_score"] * df["monthly_income"] * 12 * pct / 100).sum())


def _top_drivers(df: pd.DataFrame, k: int = 5) -> list[dict]:
    """Features most often among people's risk-raising drivers, as a share of the group."""
    counts = Counter(d["feature"] for ds in df["drivers"] for d in ds if d["direction"] == "raises")
    n = max(len(df), 1)
    return [{"feature": f, "text": FEATURE_LABELS[f], "share": round(c / n, 4)}
            for f, c in counts.most_common(k)]


@router.get("/workforce/summary")
def summary(session: SessionDep, replacement_pct: float = Query(50, alias="replacementPct",
                                                                 ge=10, le=200)) -> dict:
    df = _frame(session)
    edges = np.round(np.arange(0, 1 + BIN, BIN), 2)
    counts, _ = np.histogram(df["risk_score"], bins=edges)
    heat = (df.assign(cost=df["risk_score"] * df["monthly_income"] * 12 * replacement_pct / 100)
            .groupby(["department", "job_role"])
            .agg(n=("risk_score", "size"), meanRisk=("risk_score", "mean"),
                 expectedCost=("cost", "sum"))
            .reset_index())
    return {
        "headcount": len(df),
        "leavers": int(df["attrition"].sum()),
        "meanRisk": round(float(df["risk_score"].mean()), 4),
        "expectedLeavers": round(float(df["risk_score"].sum()), 1),
        "expectedCost": _cost(df, replacement_pct),
        "replacementPct": replacement_pct,
        "distribution": [{"bin": float(b), "count": int(c)} for b, c in zip(edges[:-1], counts, strict=True)],
        "heatmap": [{"department": r.department, "jobRole": r.job_role, "n": int(r.n),
                     "meanRisk": round(float(r.meanRisk), 4),
                     "expectedCost": float(r.expectedCost)} for r in heat.itertuples()],
        "topDrivers": _top_drivers(df),
    }


def _segment_stats(df: pd.DataFrame, seg: Segment, pct: float) -> dict:
    part = df[seg.mask(df)]
    n = len(part)
    return {
        "label": seg.label(),
        "n": n,
        "attritionRate": round(float(part["attrition"].mean()), 4) if n else None,
        "meanRisk": round(float(part["risk_score"].mean()), 4) if n else None,
        "expectedCost": _cost(part, pct),
        "topDrivers": _top_drivers(part, 3),
        "smallSample": n < SMALL_SEGMENT,
    }


@router.get("/workforce/compare")
def compare(request: Request, session: SessionDep,
            replacement_pct: float = Query(50, alias="replacementPct", ge=10, le=200)) -> dict:
    segments = {}
    for side in ("a", "b"):
        raw = {k[2:]: v for k, v in request.query_params.items() if k.startswith(f"{side}.")}
        try:
            segments[side] = Segment.model_validate(raw)
        except ValidationError as err:
            msg = err.errors()[0]["msg"]
            raise HTTPException(422, f"Invalid filter for segment {side}: {msg}") from err
    df = _frame(session)
    return {side: _segment_stats(df, seg, replacement_pct) for side, seg in segments.items()}


@router.get("/hypotheses")
def hypotheses() -> dict:
    return HYPOTHESES
