# Changelog

All notable changes to the REACH Regional Dashboard. Dates are ISO-8601.

## [0.3.0] — 2026-06-16

### Added
- **Security**
  - Bearer-token auth enforced on every data route (`Depends(current_user)`)
  - Centralised `apiFetch` wrapper in `frontend/src/http.js` (auth header + 401 redirect)
  - bcrypt password storage; configurable via `REACH_USERS_JSON`
  - `/api/auth/refresh` endpoint with configurable grace window
  - Sliding-window login rate-limit (8 attempts / 10 min per IP+username)
  - Strict Nginx security headers (CSP, HSTS, X-Frame, X-Content, Referrer-Policy, Permissions-Policy)
- **Methodology PDF download** — new menu item in the Download dropdown that generates a multi-page A4 reference PDF covering every indicator (definition / formula / numerator / denominator / exclusions / source / frequency / assumptions / references), EN/FR aware. New `/api/methodology` endpoint backs it.
- **Statistical rigour**
  - Holt forecast now grid-searches α and β on one-step-ahead MSE
  - Forecast guard raised to require ≥ 4 historical quarters with a clearer message
  - Deaths Averted now includes a low/high range derived from MORDOR's 95% CI
- **UX & data quality**
  - "Coverage above 100%" footnote on bar panels with affected counts
  - "Last updated" pill in the header (sourced from `/api/source-metadata`)
- **Reliability**
  - Top-level React `ErrorBoundary`
  - Docker healthchecks on backend + frontend; `depends_on: service_healthy`
- **Performance**
  - Pages lazy-loaded via `React.lazy` + `Suspense`
  - Long-cache `/assets/`, gzip in Nginx
- **Accessibility**
  - Global `:focus-visible` rings with the gold-600 token
  - Skip-link styles

### Changed
- Removed the date pill under the REACH brand; "Last updated" replaces it
- Home page map zoom bumped (+1) for a tighter regional view
- Auth route registration moved BEFORE the protected router include so `/api/health` stays open

### Fixed
- `/api/kpis` 500 caused by `round` argument shadowing the built-in `round()` when computing deaths-averted bounds
- Nginx security headers now repeated per-location (server-scope `add_header` doesn't inherit through location-scope `add_header`)

## [0.2.0] — earlier
- Map view toggle (Coverage / Growth) with per-state retention bars
- Wilson 95% CI tooltips on coverage
- WHO 80% reference line on trend
- Snapshot-based PDF/PPT exports waiting for Leaflet tiles
- Notifications & Reports with multi-email / multi-scope / time-of-day scheduling
- Methodology drawer per KPI with assumptions
- Feedback modal (bug / feature / data / general)
- Split-screen login (gold left, white right)
- EN/FR i18n

## [0.1.0] — initial scaffold
- React + FastAPI + SQLite stack
- 5 pages (Landing / Regional / Nigeria / Niger / Mali)
- KPI tiles, choropleth map (GADM Level-1), bar charts, trend line
- CSV / PDF / PPT downloads
