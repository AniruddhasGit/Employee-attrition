"""Load the 1,470 employees, the model run and the demo history.  Run: python -m api.seed"""

import json
import time
from datetime import date
from pathlib import Path

import pandas as pd
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from api import demo
from api.models import DemoState, Employee, ModelRun
from api.names import name_for
from api.quarters import quarter_of
from api.service import ModelService
from api.settings import get_settings
from ml.data import load_raw
from ml.features import FEATURES


def _native(v):
    return v.item() if hasattr(v, "item") else v


def _is_current(session: Session, svc: ModelService, expected: int) -> bool:
    """True when this exact training run is already loaded (same version and timestamp)."""
    run_row = session.query(ModelRun).filter_by(version=svc.metrics["version"]).one_or_none()
    if run_row is None or run_row.metrics.get("created_at") != svc.metrics.get("created_at"):
        return False
    state = session.get(DemoState, "seed")
    if state is None or state.value.get("quarter") != quarter_of(date.today()):
        return False
    return session.query(Employee).count() == expected


def run(session: Session, models_dir: Path, force: bool = False) -> int:
    """Upsert employees and the model run. Returns rows written (0 when already current)."""
    models_dir = Path(models_dir)
    svc = ModelService(models_dir)
    oof_rows = len(pd.read_parquet(models_dir / "oof.parquet"))
    if not force and _is_current(session, svc, oof_rows):
        return 0
    df = load_raw()
    oof = pd.read_parquet(models_dir / "oof.parquet")
    drivers = pd.read_parquet(models_dir / "drivers.parquet")
    df = df.merge(oof, on="EmployeeID").merge(drivers, on="EmployeeID")

    rows = [
        {
            "employee_id": int(r["EmployeeID"]),
            "name": name_for(int(r["EmployeeID"])),
            "is_current": int(r["Attrition"]) == 0,
            "record": {},
            "department": r["Department"],
            "job_role": r["JobRole"],
            "job_level": int(r["JobLevel"]),
            "years_at_company": int(r["YearsAtCompany"]),
            "monthly_income": int(r["MonthlyIncome"]),
            "overtime": r["OverTime"],
            "features": {f: _native(r[f]) for f in FEATURES},
            "risk_score": float(r["risk_score"]),
            "risk_band": svc.band(float(r["risk_score"])),
            "drivers": json.loads(r["drivers"]),
            "attrition": int(r["Attrition"]),
            "fold": int(r["fold"]),
        }
        for r in df.to_dict("records")
    ]
    # One round trip instead of 1,470: matters against a hosted database on cold starts.
    stmt = insert(Employee).values(rows)
    stmt = stmt.on_conflict_do_update(
        index_elements=[Employee.employee_id],
        set_={c: stmt.excluded[c] for c in rows[0] if c != "employee_id"},
    )
    session.execute(stmt)

    run_row = session.query(ModelRun).filter_by(version=svc.metrics["version"]).one_or_none()
    if run_row is None:
        session.add(ModelRun(version=svc.metrics["version"], metrics=svc.metrics,
                             threshold=svc.threshold))
    else:
        run_row.metrics, run_row.threshold = svc.metrics, svc.threshold
    session.commit()
    demo.seed_history(session, date.today())
    return len(df)


if __name__ == "__main__":
    from api.db import SessionLocal

    started = time.perf_counter()
    with SessionLocal() as s:
        n = run(s, get_settings().models_dir)
    took = time.perf_counter() - started
    print(f"seeded {n} employees and demo history in {took:.1f}s" if n
          else "database already current; nothing to seed")
