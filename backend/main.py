"""AutoDashMaker — FastAPI entrypoint."""
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.auth import require_user
from app.core.config import settings
from app.core.store import store  # noqa: F401  (initializes metadata schema)
from app.routers import (
    datasources, datasets, queries, charts, dash_ai, dashboards, quality, ai, studio, semantic,
    alerts, why, transforms, audit, attention, reports, qb, auth,
)
from app.services.alerts import scheduler_loop
from app.services.refresh import refresh_loop
from app.services.reports import reports_loop

import asyncio


@asynccontextmanager
async def lifespan(app: FastAPI):
    tasks = [asyncio.create_task(scheduler_loop()), asyncio.create_task(refresh_loop()), asyncio.create_task(reports_loop())]
    yield
    for t in tasks:
        t.cancel()


app = FastAPI(title=settings.app_name, version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (datasources, datasets, queries, charts, dash_ai, dashboards, quality, ai, studio,
          semantic, alerts, why, transforms, audit, attention, reports, qb):
    app.include_router(r.router, dependencies=[Depends(require_user)])
app.include_router(auth.router)  # public: /api/auth/config; /api/auth/me checks the token itself


@app.get("/api/health")
def health():
    return {"status": "ok", "app": settings.app_name, "version": "2.0.0"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

