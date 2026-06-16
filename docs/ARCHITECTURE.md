# Architecture

This document describes the high-level design of the REACH Regional Dashboard: services, data flow, key abstractions, and the decisions behind them.

## Services

The stack is two containers orchestrated by `docker compose`.

```
┌─────────────────────────┐                ┌────────────────────────────┐
│ frontend (Nginx)        │  /api/* proxy  │ backend (FastAPI/Uvicorn)  │
│  - Vite-built React SPA │ ─────────────► │  - 4 routers               │
│  - Static asset cache   │ ◄───────────── │  - SQLite + SpatiaLite     │
│  - Security headers     │                │  - /metrics                │
└─────────────────────────┘                └──────────────┬─────────────┘
                                                          │
                                                          ▼
                                              ┌────────────────────────┐
                                              │ SQLite (file-backed)   │
                                              │  treatments            │
                                              │  boundaries (geojson)  │
                                              │  scheduled_reports     │
                                              │  alerts                │
                                              │  feedback              │
                                              └────────────────────────┘
```

## Request lifecycle

1. Browser hits `https://dashboard.example.org/regional`.
2. Nginx serves `index.html` (no-cache) and the hashed Vite bundle (immutable, 1y).
3. React boots, `App.jsx` mounts `<ErrorBoundary>` → `<HoverProvider>` → `<Suspense>` → lazy `<Regional>`.
4. `<Regional>` calls `api.kpis({...})` → `http.js` → `apiFetch()` → `fetch("/api/kpis?…", { headers: { Authorization: "Bearer …" }})`.
5. Nginx proxies to `backend:8000`. FastAPI dispatches the request through:
   - `_telemetry` middleware (request count + latency)
   - `Depends(current_user)` → `auth.verify_token()` → `username` or 401
   - the route handler
6. SQLite query (read-only conn), response serialised to JSON.
7. Nginx pipes the response back; `add_header Cache-Control "no-store"` ensures filters always re-fetch.

## Authentication flow

```
┌─────────┐    POST /api/auth/login                ┌─────────┐
│ browser │ ─────────────────────────────────────► │ backend │
│         │ {username, password}                   │         │
│         │ ◄───────────────────────────────────── │         │
│         │ {token, expires_at}                    │         │
│         │                                        │         │
│ store   │  localStorage.setItem("token", t)      │         │
│         │                                        │         │
│         │    GET /api/kpis?country=NIGERIA       │         │
│         │  Authorization: Bearer t  ───────────► │         │
│         │                                        │ verify  │
│         │  200 JSON ◄───────────────────────────│         │
│         │                                        │         │
│         │  ... time passes, token expires ...    │         │
│         │                                        │         │
│         │  401 (apiFetch redirects to /login)    │         │
│ refresh │  POST /api/auth/refresh {token}        │         │
│         │ ────────────────────────────────────►  │         │
│         │ {token, expires_at}                    │         │
└─────────┘                                        └─────────┘
```

Tokens are `username.expiry.urlsafe_b64(hmac_sha256(SECRET, "username.expiry"))`. The signature is the only thing that authenticates; no DB lookup is required to verify a token. The cost is that **revocation requires rotating `REACH_SECRET`**.

## Frontend architecture

* **Pages** — `Login`, `Landing`, `Regional`, `CountryPage` (used for NGA/NER/MLI). Routes are lazy-loaded.
* **Cross-cutting state** — kept deliberately minimal:
  - `HoverContext` for brushing/linking (hovered state highlights bars + map together)
  - `auth.js` localStorage wrapper for the token
  - URL state for filters (`useFilterUrlState`)
* **HTTP layer** — every component must go through `apiFetch` (no raw `fetch()`); the wrapper handles bearer header + 401 redirect + cache: "no-store".
* **Charts** — Recharts for line / area / bar; custom CSS for the funnel + growth bars; Leaflet for the choropleth.
* **Heavy imports** — html2canvas, jsPDF, pptxgenjs are all `await import(...)` lazy, only loaded when the user clicks Download.

## Backend architecture

* **`main.py`** — FastAPI app, CORS, request-telemetry middleware, `/metrics`, mounts the four routers. Order matters: the unprotected `/api/health` is registered BEFORE the protected routers so the open route wins.
* **`deps.py`** — `current_user` dependency reads the Authorization header, verifies the HMAC signature, returns the username or raises 401.
* **`routes/api.py`** — primary aggregation endpoints (`/kpis`, `/by-country`, `/by-state`, `/trend`, `/boundaries`, `/download`). Uses a shared `_where()` helper to build parameterised SQL.
* **`routes/insights.py`** — sparklines, KPI deltas, NL chat, scheduled reports, alerts, feedback, what-if.
* **`routes/analytics.py`** — forecast (Holt + grid-search), funnel, cumulative, intensity-heatmap, retention, methodology (single + all), source-metadata.
* **`routes/auth.py`** — bcrypt verify, token mint, refresh, rate-limit.

## Data flow (ingestion)

```
Dami Action_MAIN1.xlsx                            gadm41_*_shp/*.shp
        │                                                  │
        │ pandas.read_excel                                │ pyshp + shapely
        │                                                  │ unary_union, simplify
        ▼                                                  ▼
┌────────────────────────────┐                ┌────────────────────────────┐
│ treatments table (~170k rows) │             │ boundaries table (~70 rows)│
│ year/country/state/lga +     │             │ country, admin_level, name, │
│ children_eligible / _treated │             │ geojson_text                │
│ rounds, quarter_label,…      │             │ (one row per polygon)      │
└────────────────────────────┘                └────────────────────────────┘
```

The ingest is idempotent: if the DB already exists at `DB_PATH`, it's skipped. Set `FORCE_REINGEST=1` (or delete the file) to rebuild.

## Decisions log

* **SQLite** — keeps deploy footprint minimal (no separate DB container). The dataset is ~170k rows; SQLite is comfortably fast at this scale. Move to Postgres only if multi-writer concurrency becomes a requirement.
* **No JWT library** — the token is HMAC-signed and decoded inline. JWT brings dependencies and a key-management story we don't currently need; if/when we want third-party introspection we'll switch.
* **HMAC over RS256** — single-issuer, single-verifier. Symmetric keys are simpler and acceptable.
* **Single-replica rate-limit (in-memory)** — the login limiter uses a process-local `dict[(ip, user), deque[float]]`. Adequate for a single backend container. For multi-replica deploys, swap the helpers in `routes/auth.py` for Redis-backed counters.
* **No global state on the frontend** — Context where natural (hover), URL for filters, localStorage for the token. Avoids the Redux/Zustand cost at this size.
* **`React.lazy` for pages** — login bundle is 1/3 the size of the dashboard. The `<ErrorBoundary>` wraps `<Suspense>` so a route chunk failing to fetch (CDN hiccup) shows a recoverable UI rather than a blank page.

## Out of scope (today)

* User-managed accounts (CRUD UI for the `users` table)
* SSO / OIDC
* Real-time updates (websocket push)
* Multi-replica scaling (would need Redis + Postgres)
* Server-side rendering
