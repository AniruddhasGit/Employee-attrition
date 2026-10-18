import json

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from api.db import get_session
from api.settings import get_settings

settings = get_settings()
app = FastAPI(title="Retain API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.get("/api/health")
def health(session: Session = Depends(get_session)) -> dict:
    db_ok = session.execute(text("SELECT 1")).scalar() == 1
    metrics = settings.models_dir / "metrics.json"
    version = json.loads(metrics.read_text())["version"] if metrics.exists() else None
    return {"status": "ok", "db": db_ok, "model_version": version}
