"""Load the 1,470 employees and the model run into Postgres.  Run: python -m api.seed"""

import json
from pathlib import Path

import pandas as pd
from sqlalchemy.orm import Session

from api.models import Employee, ModelRun
from api.service import ModelService
from api.settings import get_settings
from ml.data import load_raw
from ml.features import FEATURES


def _native(v):
    return v.item() if hasattr(v, "item") else v


def run(session: Session, models_dir: Path) -> int:
    models_dir = Path(models_dir)
    svc = ModelService(models_dir)
    df = load_raw()
    oof = pd.read_parquet(models_dir / "oof.parquet")
    drivers = pd.read_parquet(models_dir / "drivers.parquet")
    df = df.merge(oof, on="EmployeeID").merge(drivers, on="EmployeeID")

    for r in df.to_dict("records"):
        session.merge(Employee(
            employee_id=int(r["EmployeeID"]),
            department=r["Department"],
            job_role=r["JobRole"],
            job_level=int(r["JobLevel"]),
            years_at_company=int(r["YearsAtCompany"]),
            monthly_income=int(r["MonthlyIncome"]),
            overtime=r["OverTime"],
            features={f: _native(r[f]) for f in FEATURES},
            risk_score=float(r["risk_score"]),
            risk_band=svc.band(float(r["risk_score"])),
            drivers=json.loads(r["drivers"]),
            attrition=int(r["Attrition"]),
            fold=int(r["fold"]),
        ))

    run_row = session.query(ModelRun).filter_by(version=svc.metrics["version"]).one_or_none()
    if run_row is None:
        session.add(ModelRun(version=svc.metrics["version"], metrics=svc.metrics,
                             threshold=svc.threshold))
    else:
        run_row.metrics, run_row.threshold = svc.metrics, svc.threshold
    session.commit()
    return len(df)


if __name__ == "__main__":
    from api.db import SessionLocal

    with SessionLocal() as s:
        print(f"seeded {run(s, get_settings().models_dir)} employees")
