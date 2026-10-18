from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from api.db import SessionDep
from api.models import ModelRun

router = APIRouter(prefix="/api")


@router.get("/model/metrics")
def model_metrics(session: SessionDep) -> dict:
    run = session.scalars(select(ModelRun).order_by(ModelRun.created_at.desc())).first()
    if run is None:
        raise HTTPException(503, "Model not loaded yet; run the seed")
    m = run.metrics
    return {
        "version": m["version"], "threshold": m["threshold"], "nTest": m["n_test"],
        "nTestPos": m["n_test_pos"], "before": m["before"], "after": m["after"],
        "thresholdCurve": m["threshold_curve"], "calibration": m["calibration"],
        "fairness": m["fairness"],
    }
