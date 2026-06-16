# API Reference

Base URL: `http://localhost:8000/api` (or `https://your-host/api` in production).

All `/api/*` endpoints require a bearer token EXCEPT `/api/health` and `/api/auth/login`.

```bash
# Obtain a token
TOKEN=$(curl -sS -X POST $API/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"reach2026"}' \
  | python -c "import sys,json;print(json.load(sys.stdin)['token'])")
```

Set this once, then prefix any request with:

```bash
-H "Authorization: Bearer $TOKEN"
```

---

## Open endpoints

### `GET /api/health`

```bash
curl $API/health
# → {"status":"ok","rows":802,"boundaries":909}
```

### `POST /api/auth/login`

```bash
curl -X POST $API/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"reach2026"}'
```

Response: `{ "token": "…", "username": "admin", "expires_at": 1781622407 }`.

Failure: `401 { "detail": "Invalid username or password." }`.

Rate-limited: `429 { "detail": "Too many failed attempts. Try again later." }` after `REACH_LOGIN_MAX` failures.

### `POST /api/auth/refresh`

```bash
curl -X POST $API/auth/refresh \
  -H 'Content-Type: application/json' \
  -d "{\"token\":\"$TOKEN\"}"
```

Accepts tokens within `REACH_REFRESH_GRACE` of expiry.

### `GET /api/auth/me`

```bash
curl -H "Authorization: Bearer $TOKEN" $API/auth/me
# → {"username":"admin"}
```

---

## Data endpoints (require bearer)

### `GET /api/filters`

Returns cascading filter options.

Query: `country?, state?, year?, quarter?, round?` (use what's selected to narrow downstream choices).

```bash
curl -H "Authorization: Bearer $TOKEN" "$API/filters?country=NIGERIA"
```

### `GET /api/kpis`

```bash
curl -H "Authorization: Bearer $TOKEN" "$API/kpis?country=NIGERIA"
```

```json
{
  "children_eligible": 29210512,
  "children_treated": 26598824,
  "percentage_treated": 91,
  "severe_adverse_event": 0,
  "deaths_averted": 26598,
  "deaths_averted_low": 13299,
  "deaths_averted_high": 39898,
  "deaths_averted_note": "Central 1/1,000; range derived from MORDOR 95% CI"
}
```

### `GET /api/kpi-deltas`

Latest-quarter snapshot vs the previous quarter, per KPI.

### `GET /api/by-country`

Per-country eligible / treated / %.

```bash
curl -H "Authorization: Bearer $TOKEN" "$API/by-country?year=2025&round=3"
```

### `GET /api/by-state`

Per-state eligible / treated / % within a given country.

```bash
curl -H "Authorization: Bearer $TOKEN" "$API/by-state?country=NIGERIA&year=2025&round=3"
```

### `GET /api/trend`

Quarter-keyed % treated points.

### `GET /api/boundaries`

GeoJSON FeatureCollection with the active metric joined to each polygon.

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "$API/boundaries?country=NIGERIA&admin_level=1" | jq '.features | length'
```

### `GET /api/download`

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "$API/download?country=NIGERIA&format=csv" -o reach_nigeria.csv
```

Formats: `csv`, `pdf`, `pptx`.

### `GET /api/sparkline`

Last N quarterly points for the KPI mini-charts (`last_n` default 6).

### `GET /api/forecast`

```bash
curl -H "Authorization: Bearer $TOKEN" "$API/forecast?country=NIGERIA&horizon=2"
```

```json
{
  "history": [ { "quarter":"2024 Q4","eligible":…, "treated":…, "percentage":98 } ],
  "forecast": [
    { "quarter":"2026 Q1", "percentage":94.2,
      "ci80_lo":89.1, "ci80_hi":99.3, "ci95_lo":86.4, "ci95_hi":102.0, "is_forecast":true }
  ],
  "method": "Holt linear (α=0.3, β=0.2 — grid-searched)",
  "sigma_residual": 4.21,
  "min_history": 4, "have_history": 6
}
```

If fewer than 4 historical quarters are available, `forecast` is empty and `note` explains why.

### `GET /api/funnel`

```bash
curl -H "Authorization: Bearer $TOKEN" "$API/funnel?country=NIGERIA"
```

### `GET /api/cumulative`

Cumulative coverage by round.

### `GET /api/intensity-heatmap`

State × round coverage matrix.

```bash
curl -H "Authorization: Bearer $TOKEN" "$API/intensity-heatmap?country=NIGERIA"
```

### `GET /api/retention`

Round-on-round retention rate.

### `GET /api/retention-by-state`

Per-state round-on-round retention with delta and gain/loss flag.

### `GET /api/methodology/{indicator}`

Single-indicator methodology. `lang=en|fr`.

```bash
curl -H "Authorization: Bearer $TOKEN" "$API/methodology/deaths_averted?lang=fr"
```

### `GET /api/methodology`

**All** indicators in one payload. Used by the "All methodology (PDF)" download.

```bash
curl -H "Authorization: Bearer $TOKEN" "$API/methodology?lang=en"
```

### `GET /api/source-metadata`

Source / extraction date / validation date / version / coverage period / license per country (or `REGIONAL`).

### `POST /api/chat`

Natural-language question → answer.

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"question":"Which country has the highest coverage?"}' \
  $API/chat
```

### `GET /api/recommendations`

AI-style next-step recommendations for the current scope.

### `GET / POST / DELETE /api/reports`

```bash
# Schedule
curl -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"emails":["lead@example.org"],"scopes":["NIGERIA"],"format":"pdf","cadence":"weekly","send_time":"08:00","timezone":"Africa/Lagos"}' \
  $API/reports

# List
curl -H "Authorization: Bearer $TOKEN" $API/reports

# Cancel
curl -X DELETE -H "Authorization: Bearer $TOKEN" $API/reports/3
```

### `GET / POST / DELETE /api/alerts`

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"email":"lead@example.org","scope":"NIGERIA","metric":"percentage","comparison":"lt","threshold":80}' \
  $API/alerts
```

### `GET / POST /api/feedback`

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"kind":"bug","subject":"Coverage shows 0 for Niger","message":"…","email":"reporter@example.org","page":"/niger"}' \
  $API/feedback
```

### `POST /api/whatif`

Deterministic projection for operational levers.

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"country":"NIGERIA","coverage_uplift_pct":3,"reporting_uplift_pct":5,"staff_uplift_pct":10,"facility_uplift_pct":5}' \
  $API/whatif
```

---

## Error format

```json
{
  "detail": "Invalid or expired token."
}
```

| Status | Meaning |
|---|---|
| 200 | OK |
| 400 | Bad request (validation error or unknown country) |
| 401 | Missing / invalid / expired bearer token |
| 404 | Not found (e.g., unknown indicator) |
| 429 | Login rate-limit |
| 500 | Server error — check `docker compose logs backend` |

---

## Interactive UI

Swagger UI lives at `http://localhost:8000/docs` and ReDoc at `/redoc`. Both honour the bearer-token auth — paste a token into the "Authorize" dialog to call protected endpoints.
