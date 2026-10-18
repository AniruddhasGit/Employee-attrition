import json
from contextlib import asynccontextmanager
from datetime import UTC, datetime

from fastapi import Depends, FastAPI
from sqlalchemy import text

from api.auth import require_same_origin
from api.db import SessionLocal
from api.settings import get_settings

settings = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Clear yesterday's visitor edits when a sleeping free instance wakes up, and apply
    the configured demo password."""
    from api import demo

    with SessionLocal() as db:
        demo.maybe_reset(db, datetime.now(UTC), allow_full=False)
        demo.sync_passwords(db)
    yield

# Browsers reach the API only through the web app's same-origin proxy, so there is no CORS.
# Every state-changing request must carry the site's own Origin (CSRF guard).
app = FastAPI(title="Retain API", version="1.0.0", lifespan=lifespan,
              dependencies=[Depends(require_same_origin)])


@app.get("/api/health")
def health(deep: bool = False) -> dict:
    """Liveness for the host's frequent probes: no database query, so the free Neon compute can
    sleep. Pass ?deep=1 to also check the database."""
    metrics = settings.models_dir / "metrics.json"
    version = json.loads(metrics.read_text())["version"] if metrics.exists() else None
    out = {"status": "ok", "model_version": version}
    if deep:
        with SessionLocal() as session:
            out["db"] = session.execute(text("SELECT 1")).scalar() == 1
    return out


from api.routes import auth, contact, hr, hr_people, me, public  # noqa: E402

app.include_router(auth.router)
app.include_router(me.router)
app.include_router(hr.router)
app.include_router(hr_people.router)
app.include_router(public.router)
app.include_router(contact.router)
