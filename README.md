# REACH Regional Dashboard

> Monitoring dashboard for the **REACH (Resiliency through Azithromycin for Children)** programme in **Nigeria, Niger and Mali**, built as a containerised React + FastAPI + SQLite stack.

The dashboard reproduces the original Tableau workbook in colour palette, KPI tiles, chart placement, choropleth map, filter bar and country drill-downs — then layers on top: an authenticated user model, an AI-style insight engine, EN/FR i18n, scheduled reports, anomaly alerts, a methodology drawer per indicator, snapshot-based PDF/PPT exports and a downloadable "all methodology" reference PDF.

[![docker](https://img.shields.io/badge/run-docker%20compose%20up-blue)](#-quick-start-docker) [![python](https://img.shields.io/badge/python-3.12-blue)](backend/Dockerfile) [![react](https://img.shields.io/badge/react-18-61dafb)](frontend/package.json) [![license](https://img.shields.io/badge/license-MIT-green)](LICENSE)

---

## Table of contents

1. [Feature tour](#1-feature-tour)
2. [Architecture](#2-architecture)
3. [Repository layout](#3-repository-layout)
4. [Quick start (Docker)](#4-quick-start-docker)
5. [Local development (without Docker)](#5-local-development-without-docker)
6. [Configuration / environment variables](#6-configuration--environment-variables)
7. [Authentication & security](#7-authentication--security)
8. [Backend API reference](#8-backend-api-reference)
9. [Database schema](#9-database-schema)
10. [Frontend structure](#10-frontend-structure)
11. [Internationalisation (EN/FR)](#11-internationalisation-enfr)
12. [Maps and geospatial pipeline](#12-maps-and-geospatial-pipeline)
13. [Downloads & methodology reference](#13-downloads--methodology-reference)
14. [Re-ingesting / refreshing data](#14-re-ingesting--refreshing-data)
15. [Observability](#15-observability)
16. [Troubleshooting](#16-troubleshooting)
17. [Contributing](#17-contributing)
18. [Further reading](#18-further-reading)

Additional in-depth docs:

* [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — system design, data flow, decisions
* [docs/SECURITY.md](docs/SECURITY.md) — threat model, auth, rate limits, headers
* [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — production deploy on Linux + reverse proxy
* [docs/API.md](docs/API.md) — every endpoint with examples
* [docs/METHODOLOGY.md](docs/METHODOLOGY.md) — indicator definitions and assumptions
* [CHANGELOG.md](CHANGELOG.md) — release history

---

## 1. Feature tour

### Five primary pages

| Route | What it shows |
|---|---|
| `/login` | Username / password login (bcrypt-verified), with terms-of-use modal |
| `/` Landing | Title, KPIs, big regional choropleth, "Quick navigation" side menu |
| `/regional` | Regional aggregations + cascading filters + bar charts + trend / forecast |
| `/nigeria` | Country drill-down (state-level choropleth + bars) |
| `/niger` | Country drill-down |
| `/mali` | Country drill-down |

### Five headline KPIs (with deltas, sparklines and methodology drawers)

* Children Eligible
* Children Treated
* Percentage Treated (Coverage)
* Severe Adverse Effects
* Estimated Deaths Averted *(with a low–high uncertainty band derived from MORDOR's 95% CI)*

### Analytics & charts

* **Cascading filters** (Year → Quarter → Round) with URL-state persistence
* **Bar chart toggles** — *By State* coverage vs *Round-on-Round Growth* (gain/loss bars)
* **Trend / Forecast toggle** — Holt's linear trend with grid-searched α/β and 80% + 95% prediction-interval bands
* **Map view toggle** — *Coverage* (single-hue gold) vs *Growth* (diverging gain/loss palette)
* **Cumulative coverage by round** (composed bar + line)
* **Funnel view** — Eligible → Reached → Treated → Reported → Verified
* **Intensity heatmap** — states × rounds
* **Cohort retention** — round-on-round and per-state retention bars
* **Brushing & linking** — hover any state row, map and heatmap highlight in sync
* **Methodology drawer** on every KPI: definition, formula, numerator, denominator, exclusions, source, frequency, assumptions, references (EN/FR)

### Workflow tooling

* **AI Assistant drawer** — natural-language Q&A + automatic anomaly recommendations
* **Scheduled email reports** — multi-email, multi-scope, time-of-day + timezone, daily / weekly / monthly cadence
* **Threshold alerts** — `metric` `lt|gt` `threshold` per scope
* **Feedback** — bug / feature / data / general, captured to a `feedback` table
* **Downloads** — current page as PDF/PPT (snapshot), full dataset as CSV/PDF/PPT, **and a multi-page methodology reference PDF** that covers every indicator

### Operational extras

* Bearer-token auth on every data route (with refresh + login rate-limit)
* Strict security headers in Nginx (CSP, HSTS, X-Frame, Referrer-Policy, Permissions-Policy)
* `/metrics` Prometheus exposition
* React `ErrorBoundary` so a single bad component can't blank the page
* Docker healthchecks on both services with `depends_on: condition: service_healthy`
* Code-split routes via `React.lazy` so login stays light
* Global `:focus-visible` rings + skip link for keyboard users

---

## 2. Architecture

```
            EN/FR · filters · KPI tiles · charts · maps · downloads · AI · alerts
                                       ▲
                                       │
                                  ┌────┴─────┐
                                  │ Browser  │
                                  └────┬─────┘
                                       │  HTTPS
              ┌────────────────────────┴───────────────────────┐
              │ Nginx (frontend container, port 80)            │
              │  - serves static Vite build                    │
              │  - injects CSP / HSTS / X-Frame / Referrer     │
              │  - proxies /api/* → backend:8000               │
              └────────────────────────┬───────────────────────┘
                                       │
              ┌────────────────────────┴───────────────────────┐
              │ FastAPI / Uvicorn (backend container)          │
              │  - bcrypt login, HMAC-signed bearer tokens     │
              │  - 4 routers: api · insights · analytics · auth│
              │  - /metrics (Prometheus)                       │
              └────────────────────────┬───────────────────────┘
                                       │
                       ┌───────────────┴───────────────┐
                       │ SQLite (SpatiaLite available) │
                       │  treatments · boundaries      │
                       │  scheduled_reports · alerts   │
                       │  feedback                     │
                       └───────────────────────────────┘
```

Detailed sequence diagrams: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## 3. Repository layout

```
REACH Dashboard/
├── docker-compose.yml                # one-command stack (with healthchecks)
├── README.md                         # this file
├── LICENSE                           # MIT
├── CHANGELOG.md                      # release notes
├── .gitignore  .dockerignore         # excludes large source data, DB, secrets
├── docs/                             # extended documentation
│   ├── ARCHITECTURE.md
│   ├── SECURITY.md
│   ├── DEPLOYMENT.md
│   ├── API.md
│   └── METHODOLOGY.md
│
├── Dami Action_MAIN1.xlsx            # SOURCE: place your Excel here (gitignored)
├── gadm41_NGA_shp/                   # SOURCE: GADM Nigeria polygons (gitignored)
├── gadm41_NER_shp/                   # SOURCE: GADM Niger polygons   (gitignored)
├── gadm41_MLI_shp/                   # SOURCE: GADM Mali polygons    (gitignored)
│
├── backend/
│   ├── Dockerfile
│   ├── entrypoint.sh                 # runs ingest if DB missing, then uvicorn
│   ├── requirements.txt              # incl. bcrypt, email-validator
│   ├── data/                         # SQLite DB lives here (mounted; gitignored)
│   └── app/
│       ├── main.py                   # FastAPI app + CORS + /metrics + telemetry
│       ├── deps.py                   # current_user dep (bearer-token guard)
│       ├── database.py               # SQLite + SpatiaLite + schema bootstrap
│       ├── routes/
│       │   ├── api.py                # /kpis /by-country /by-state /trend /boundaries /download
│       │   ├── insights.py           # /sparkline /chat /recommendations /reports /alerts /feedback /whatif
│       │   ├── analytics.py          # /forecast /funnel /cumulative /intensity-heatmap /retention /methodology /source-metadata
│       │   └── auth.py               # /auth/login /auth/refresh /auth/me (bcrypt + rate-limit)
│       └── ingest/load_data.py       # Excel + shapefile ingestion
│
└── frontend/
    ├── Dockerfile                    # multi-stage: node build → nginx serve
    ├── nginx.conf                    # /api proxy + security headers + cache headers
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── main.jsx · App.jsx        # router root with ErrorBoundary + lazy pages
        ├── i18n.js                   # EN/FR setup
        ├── http.js                   # centralized fetch wrapper (auth + 401 handling)
        ├── api.js                    # thin typed wrapper over http.js
        ├── auth.js                   # localStorage token store
        ├── styles.css                # gold palette, KPI tiles, drawers, maps
        ├── locales/                  # en.json, fr.json
        ├── components/               # KpiRow, FilterBar, MapView, TrendLine,
        │                             # ForecastTrend, Funnel, IntensityHeatmap,
        │                             # RetentionChart, StateRetentionBars,
        │                             # CumulativeCoverage, AIAssistant, Chatbot,
        │                             # Recommendations, Subscriptions, FeedbackModal,
        │                             # MethodologyDrawer, DownloadMenu, ErrorBoundary,
        │                             # SourceLine, Header, FloatingMenu, …
        ├── context/HoverContext.jsx  # brushing/linking between state row + map
        └── pages/
            ├── Login.jsx
            ├── Landing.jsx
            ├── Regional.jsx
            └── CountryPage.jsx       # used for NGA, NER, MLI
```

---

## 4. Quick start (Docker)

**Prereqs:** Docker Desktop on Windows / macOS, or Docker Engine + Compose v2 on Linux.

```powershell
# 1. From the project root, make sure the source files exist next to docker-compose.yml:
#    - Dami Action_MAIN1.xlsx
#    - gadm41_NGA_shp/
#    - gadm41_NER_shp/
#    - gadm41_MLI_shp/

# 2. Build and start (first build is ~3-5 min)
docker compose up --build -d

# 3. Wait until both services report Healthy
docker compose ps

# 4. Open:
#    Frontend  →  http://localhost:3000   (login: admin / reach2026)
#    Backend   →  http://localhost:8000/docs   (Swagger)
#    Metrics   →  http://localhost:8000/metrics
```

The first start runs the ingestion script automatically. The DB lives at `./backend/data/reach.db`; ingestion is skipped on later starts unless you set `FORCE_REINGEST=1` or delete the DB.

**Stop**: `docker compose down` (data volume persists).
**Reset DB**: `docker compose down && rm backend/data/reach.db && docker compose up -d`.

---

## 5. Local development (without Docker)

### Backend

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt

$env:DB_PATH    = "$PWD\data\reach.db"
$env:EXCEL_PATH = "..\Dami Action_MAIN1.xlsx"
$env:SHP_NGA    = "..\gadm41_NGA_shp"
$env:SHP_NER    = "..\gadm41_NER_shp"
$env:SHP_MLI    = "..\gadm41_MLI_shp"

python -m app.ingest.load_data        # one-time ingest
uvicorn app.main:app --reload --port 8000
```

### Frontend

```powershell
cd frontend
npm install
npm run dev        # http://localhost:5173 with HMR (proxies /api → 8000)
```

### Default credentials (dev only)

```
username: admin
password: reach2026
```

Change in production via `REACH_USERS_JSON` (see § 7).

---

## 6. Configuration / environment variables

### Backend

| Variable                 | Default                                                | Purpose                                                            |
|--------------------------|--------------------------------------------------------|--------------------------------------------------------------------|
| `DB_PATH`                | `backend/data/reach.db`                                | SQLite file location                                               |
| `EXCEL_PATH`             | `/data_sources/Dami Action_MAIN1.xlsx`                 | Source workbook for ingestion                                      |
| `SHP_NGA` / `_NER` / `_MLI` | `/data_sources/gadm41_*_shp`                        | Shapefile directories                                              |
| `CORS_ORIGINS`           | `http://localhost:3000,http://localhost:5173`          | Comma-separated allowed origins (set `*` only in dev)              |
| `FORCE_REINGEST`         | `0`                                                    | Set `1` to rebuild DB on container start                           |
| `REACH_AUTH_OPTIONAL`    | `0`                                                    | Set `1` to bypass auth (dev only — every request becomes user `dev`)|
| `REACH_USERS_JSON`       | *(unset)*                                              | JSON of `{ "username": "<bcrypt-hash>" }`. Preferred over single-user mode. |
| `REACH_USER` / `REACH_PASS` | `admin` / `reach2026`                               | Fallback single-user pair if `REACH_USERS_JSON` is unset           |
| `REACH_SECRET`           | `reach-dashboard-default-secret`                       | **Change this** — HMAC key signing bearer tokens                   |
| `REACH_TOKEN_TTL`        | `28800`                                                | Token lifetime (seconds; 8h default)                               |
| `REACH_REFRESH_GRACE`    | `3600`                                                 | How long after expiry the `/auth/refresh` window stays open        |
| `REACH_LOGIN_MAX`        | `8`                                                    | Max failed login attempts per IP+username in the window            |
| `REACH_LOGIN_WINDOW`     | `600`                                                  | Sliding-window length (seconds) for the login rate-limit           |

### Frontend (build args)

| Variable           | Default | Purpose                                          |
|--------------------|---------|--------------------------------------------------|
| `VITE_API_BASE`    | `/api`  | API base URL baked into the Vite build           |

A starter `.env.example` is provided in `backend/` — copy to `.env` for local use; **never commit a real `.env`**.

---

## 7. Authentication & security

* **Login** — `POST /api/auth/login` returns an HMAC-signed bearer token (`username.expiry.signature`) valid for `REACH_TOKEN_TTL` seconds.
* **Refresh** — `POST /api/auth/refresh` accepts a still-valid or recently-expired token (within `REACH_REFRESH_GRACE`) and issues a fresh one.
* **Passwords** — bcrypt (cost 12). Configure via `REACH_USERS_JSON='{"alice":"$2b$12$..."}'`.
* **Rate limit** — sliding-window: 8 failed attempts per IP+username per 10 minutes → 429.
* **Bearer guard** — every `/api/{data}` route uses `Depends(current_user)`. The frontend's [`http.js`](frontend/src/http.js) wrapper injects the token and bounces to `/login` on 401.
* **CORS** — locked to `CORS_ORIGINS`; default is the two local dev origins.
* **Nginx security headers** — CSP, HSTS, X-Frame-Options: SAMEORIGIN, X-Content-Type-Options: nosniff, Referrer-Policy: strict-origin-when-cross-origin, Permissions-Policy.

Generate a bcrypt hash in Python:

```python
import bcrypt
print(bcrypt.hashpw(b"my-strong-pass", bcrypt.gensalt(rounds=12)).decode())
```

Full threat model: [docs/SECURITY.md](docs/SECURITY.md).

---

## 8. Backend API reference

Base path: `/api`. **All `/api/*` routes require a bearer token except `/api/health` and `/api/auth/login`.**

### Open routes

| Method | Path                | Body / Query                                   | Returns                                  |
|--------|---------------------|------------------------------------------------|------------------------------------------|
| GET    | `/health`           | —                                              | `{status, rows, boundaries}`             |
| POST   | `/auth/login`       | `{username, password}`                         | `{token, username, expires_at}`          |
| POST   | `/auth/refresh`     | `{token}`                                      | `{token, username, expires_at}`          |
| GET    | `/auth/me`          | header `Authorization: Bearer …`               | `{username}`                             |

### Data routes (require bearer token)

| Method | Path                         | Purpose                                                          |
|--------|------------------------------|------------------------------------------------------------------|
| GET    | `/filters`                   | Cascading filter options                                         |
| GET    | `/kpis`                      | 5 KPI tile values + deaths-averted low/high range                |
| GET    | `/kpi-deltas`                | Latest-vs-previous-quarter deltas per KPI                        |
| GET    | `/by-country`                | Country-level eligible/treated/%                                 |
| GET    | `/by-state`                  | State-level eligible/treated/%                                   |
| GET    | `/trend`                     | Quarter-keyed % treated points                                   |
| GET    | `/boundaries`                | GeoJSON `FeatureCollection` with current-filter metric joined    |
| GET    | `/download`                  | Filtered rows as CSV / PDF / PPTX                                |
| GET    | `/sparkline`                 | Last-N quarterly points (KPI mini-charts)                        |
| GET    | `/forecast`                  | History + N-quarter Holt forecast with PI bands                  |
| GET    | `/funnel`                    | Eligible → Reached → Treated → Reported → Verified               |
| GET    | `/cumulative`                | Cumulative coverage by round                                     |
| GET    | `/intensity-heatmap`         | State × round coverage matrix                                    |
| GET    | `/retention`                 | Round-on-round retention                                         |
| GET    | `/retention-by-state`        | Per-state round-on-round retention                               |
| GET    | `/methodology/{indicator}`   | Single-indicator methodology (EN/FR)                             |
| GET    | `/methodology`               | **All** indicators in one payload (used by the methodology PDF)  |
| GET    | `/source-metadata`           | Source / extraction date / validation date / version per country |
| POST   | `/chat`                      | Natural-language question → answer                               |
| GET    | `/recommendations`           | AI-style next-step recommendations                               |
| GET/POST/DELETE | `/reports`          | List / schedule / cancel email reports                           |
| GET/POST/DELETE | `/alerts`           | List / arm / disarm threshold alerts                             |
| GET/POST | `/feedback`                | Submit bugs / feature requests; admin list                       |
| POST   | `/whatif`                    | Deterministic projection for operational levers                  |

Full reference with examples: [docs/API.md](docs/API.md) and the live Swagger UI at `http://localhost:8000/docs`.

Sample authenticated call:

```bash
TOKEN=$(curl -sS -X POST http://localhost:8000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"reach2026"}' \
  | python -c "import sys,json;print(json.load(sys.stdin)['token'])")

curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/by-state?country=NIGERIA&year=2025&round=3"
```

---

## 9. Database schema

```sql
treatments (
  id, sn, year, country, state, lga, conc,
  match_spatial, spatial_state, spatial_state_plain,
  children_treated, children_eligible, treated_fg,
  death_averted, severe_adverse_event,
  rounds, quarter, quarter_measure, quarter_label, country25
);

boundaries (
  id, country, admin_level, name, name_upper, parent, geojson
);

scheduled_reports (id, email, scope, format, cadence, send_time, timezone, created_at);
alerts            (id, email, metric, comparison, threshold, scope, created_at);
feedback          (id, kind, subject, message, email, username, page, created_at);
```

Indexes are created on `country`, `year`, `quarter_label`, `rounds`, `spatial_state`, `boundaries.country`, `boundaries.admin_level`. All string fields are upper-cased during ingest so the spatial join (`treatments.spatial_state` ↔ `boundaries.name_upper`) is robust.

---

## 10. Frontend structure

* **Routing & error handling** — `App.jsx` wraps the router in `<ErrorBoundary>` and uses `React.lazy` for the three dashboard pages so the login bundle stays small.
* **State management** — local React state + URL state for filters (via `useFilterUrlState`). No global store needed at this size; brushing/linking uses a small `HoverContext`.
* **HTTP layer** — every component goes through [`http.js`](frontend/src/http.js): bearer-token injection, 401 → login bounce, cache-disabled.
* **Styling** — single-hue gold palette (`#e3c934` darker → `#fdf4cd` lighter) with a warm taupe ink scale; design tokens in `styles.css`.
* **Charts** — Recharts for trend / forecast / cumulative / retention; custom CSS for the funnel and growth bars; Leaflet for the choropleth.

---

## 11. Internationalisation (EN/FR)

Toggle in the top-right header. Translations live in [`frontend/src/locales/en.json`](frontend/src/locales/en.json) and [`fr.json`](frontend/src/locales/fr.json). The selected language is persisted in `localStorage` (`reach.lang`).

To add a string: add the same key to **both** files and reference via `t("your_key")`. The methodology drawer fetches the localised version from `/api/methodology/{indicator}?lang=fr`.

---

## 12. Maps and geospatial pipeline

* **Source format** — GADM Level-1 shapefiles (admin states / regions).
* **Ingestion** — `pyshp` reads each `.shp`; names from `NAME_1`; geometries unioned per name with `shapely.ops.unary_union`; simplified with `geometry.simplify(0.01)` to keep payloads small.
* **Storage** — as **GeoJSON text** in `boundaries.geojson` (one row per polygon).
* **Serving** — `/api/boundaries` joins each polygon to the aggregated KPI for the active filter set; returns a `FeatureCollection` to Leaflet.
* **Rendering** — Leaflet `GeoJSON` layer coloured by `% Treated` (single-hue gold) or `Round-on-Round Growth` (diverging gain/loss) depending on the map toggle.

The GADM directories include `_0` country, `_1` state/region, `_2`–`_4` deeper levels; today only `_1` is used. The pipeline is in place to drill down further.

---

## 13. Downloads & methodology reference

Click the cloud icon in the header to open the download menu:

* **Current page as PDF** — uses `html2canvas` after waiting for all Leaflet tiles to finish loading, then writes a one-page PDF with a header strip (title, scope, source, timestamp).
* **All data — PDF / PPTX / CSV** — full-scope downloads with the same header.
* **All methodology (PDF)** — a multi-page A4 reference document covering every indicator: definition, formula, numerator, denominator, exclusions, source, frequency, assumptions, and references. EN/FR aware. Sourced from `/api/methodology?lang=…`.

---

## 14. Re-ingesting / refreshing data

```powershell
# Option A: nuke the DB so the entrypoint re-ingests
docker compose down
Remove-Item .\backend\data\reach.db
docker compose up -d

# Option B: force re-ingest on next start
docker compose up -d -e FORCE_REINGEST=1
```

To run ingestion ad-hoc against a running container:

```bash
docker exec -it reach-backend python -m app.ingest.load_data
```

---

## 15. Observability

* **`/metrics`** — Prometheus exposition (`reach_requests_total`, `reach_request_latency_seconds_sum`, `reach_requests_by_path`).
* **Healthchecks** — both containers expose Docker healthchecks; the frontend `depends_on: condition: service_healthy` on the backend.
* **Logs** — `docker compose logs -f backend frontend`.
* **Browser console** — the `ErrorBoundary` logs uncaught render errors with the component stack.

---

## 16. Troubleshooting

| Symptom | Likely cause / fix |
|---------|---------------------|
| `/api/health` returns `{rows: -1}` or `{rows: 0}` | Ingestion didn't run. Check `docker compose logs backend`; usually a missing source mount. |
| Map polygons render but are all white | `treatments.spatial_state` doesn't match `boundaries.name_upper`. Try `SELECT DISTINCT spatial_state FROM treatments WHERE country='NIGERIA';`. |
| `OperationalError: unable to open database file` | `./backend/data` not writable. On Windows, give Docker Desktop file-sharing access to the project drive. |
| Frontend can't reach `/api/*` in dev | Vite proxies `/api` to `VITE_API_BASE`. Make sure the backend is running. |
| Login returns 429 | Hit the rate-limit. Wait 10 min, or bump `REACH_LOGIN_MAX` / `REACH_LOGIN_WINDOW`. |
| Snapshot PDF shows scattered map tiles | Wait a moment after loading the page; the snapshot waits for Leaflet tiles, but big basemaps can take >4s. |
| EN/FR toggle does nothing | Clear `localStorage.reach.lang` and reload. |

---

## 17. Contributing

1. Fork or branch from `main`.
2. `docker compose up -d` to get the stack running.
3. Make changes, run `docker compose build {service}` then `docker compose up -d` again.
4. Verify with a smoke test:
   ```bash
   curl http://localhost:8000/api/health           # 200
   curl -X POST http://localhost:8000/api/auth/login \
     -H 'Content-Type: application/json' \
     -d '{"username":"admin","password":"reach2026"}'
   ```
5. Open a PR against `main`.

Coding conventions:

* Python — type hints where they add clarity, `from __future__ import annotations` on new modules.
* JS — functional React, prefer hooks. Always go through `apiFetch` from `http.js` (never raw `fetch()`).
* Translations — add to **both** `en.json` and `fr.json` in the same PR.

---

## 18. Further reading

* [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — diagrams, component map, data flow
* [docs/SECURITY.md](docs/SECURITY.md) — auth flow, threat model, headers, rate limits
* [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — TLS, reverse proxy, scaling
* [docs/API.md](docs/API.md) — every endpoint with curl examples
* [docs/METHODOLOGY.md](docs/METHODOLOGY.md) — indicator definitions, formulas, assumptions, references
* [CHANGELOG.md](CHANGELOG.md) — version history

---

**Maintainer**: Benjamin Shaibu · [benjamin.shaibu@ehealthnigeria.org](mailto:benjamin.shaibu@ehealthnigeria.org)
**Support**: [info@ehealthafrica.org](mailto:info@ehealthafrica.org)
**Programme**: [reachnetwork.africa](https://reachnetwork.africa/)
**License**: [MIT](LICENSE)
