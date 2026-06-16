from __future__ import annotations

import os
import time

from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

from .routes import api, auth, insights, analytics
from .deps import current_user

app = FastAPI(
    title="REACH Regional Dashboard API",
    description="Backend for the REACH (Resiliency through Azithromycin for Children) dashboard.",
    version="0.2.0",
)

# CORS — locked to known origins by default. Set REACH_CORS=* in dev only.
default_origins = "http://localhost:3000,http://localhost:5173"
origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", default_origins).split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


# ----- Prometheus-friendly request counters & latency (no extra deps) ---------
_metrics = {"requests_total": 0, "errors_total": 0, "by_path": {}, "lat_sum": 0.0}

@app.middleware("http")
async def _telemetry(request: Request, call_next):
    t0 = time.monotonic()
    try:
        resp: Response = await call_next(request)
        return resp
    finally:
        dt = time.monotonic() - t0
        _metrics["requests_total"] += 1
        _metrics["lat_sum"] += dt
        path = request.url.path
        _metrics["by_path"][path] = _metrics["by_path"].get(path, 0) + 1


@app.get("/metrics")
def metrics():
    """Plaintext Prometheus exposition. Lightweight — no extra deps."""
    lines = [
        "# HELP reach_requests_total Total HTTP requests served.",
        "# TYPE reach_requests_total counter",
        f'reach_requests_total {_metrics["requests_total"]}',
        "# HELP reach_request_latency_seconds_sum Cumulative request latency.",
        "# TYPE reach_request_latency_seconds_sum counter",
        f'reach_request_latency_seconds_sum {_metrics["lat_sum"]:.6f}',
    ]
    for path, n in sorted(_metrics["by_path"].items()):
        lines.append(f'reach_requests_by_path{{path="{path}"}} {n}')
    return Response(content="\n".join(lines) + "\n", media_type="text/plain; version=0.0.4")


@app.get("/")
def root():
    return {"service": "reach-dashboard", "status": "ok", "docs": "/docs"}


@app.get("/api/health")
def health_unprotected():
    """Health endpoint — UNPROTECTED so container healthchecks work.
    Registered BEFORE the protected api router so the open route wins."""
    import sqlite3
    from .database import get_conn
    try:
        with get_conn(read_only=True) as conn:
            n = conn.execute("SELECT COUNT(*) AS n FROM treatments").fetchone()["n"]
            b = conn.execute("SELECT COUNT(*) AS n FROM boundaries").fetchone()["n"]
    except sqlite3.OperationalError:
        n, b = -1, -1
    return {"status": "ok", "rows": n, "boundaries": b}


# Auth-protected data routes (every route inside `api`, `insights`, `analytics`)
PROTECTED = Depends(current_user)

# Auth routes (login/me/refresh) and /health stay open.
app.include_router(api.router,       prefix="/api", dependencies=[PROTECTED])
app.include_router(insights.router,  prefix="/api", dependencies=[PROTECTED], tags=["insights"])
app.include_router(analytics.router, prefix="/api", dependencies=[PROTECTED], tags=["analytics"])
app.include_router(auth.router,      prefix="/api/auth", tags=["auth"])
