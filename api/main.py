import json
from contextlib import asynccontextmanager
from datetime import UTC, datetime

from fastapi import Depends, FastAPI
from sqlalchemy import text

from api.auth import require_same_origin
from api.db import SessionDep, SessionLocal
from api.settings import get_settings

settings = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Clear yesterday's visitor edits when a sleeping free instance wakes up."""
    from api import demo

    with SessionLocal() as db:
        demo.maybe_reset(db, datetime.now(UTC), allow_full=False)
    yield

# Browsers reach the API only through the web app's same-origin proxy, so there is no CORS.
# Every state-changing request must carry the site's own Origin (CSRF guard).
app = FastAPI(title="Retain API", version="1.0.0", lifespan=lifespan,
              dependencies=[Depends(require_same_origin)])


@app.get("/api/health")
def health(session: SessionDep) -> dict:
    db_ok = session.execute(text("SELECT 1")).scalar() == 1
    metrics = settings.models_dir / "metrics.json"
    version = json.loads(metrics.read_text())["version"] if metrics.exists() else None
    return {"status": "ok", "db": db_ok, "model_version": version}


from api.routes import auth, contact, hr, hr_people, me  # noqa: E402

app.include_router(auth.router)
app.include_router(me.router)
app.include_router(hr.router)
app.include_router(hr_people.router)
app.include_router(contact.router)
