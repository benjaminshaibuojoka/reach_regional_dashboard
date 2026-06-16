# Security

## Threat model

| Asset | Threat | Mitigation |
|---|---|---|
| Programme data (treatments, KPIs) | Unauthorised read | Bearer-token guard on every data route; bcrypt-verified login |
| User credentials | Brute force | Sliding-window login rate-limit (8 attempts / 10 min per IP+user) |
| Tokens | Theft via XSS | CSP `default-src 'self'`, `script-src 'self' 'unsafe-inline'` (no third-party origins), CORS limited to known origins, secure cookie posture (when behind TLS) |
| Tokens | Replay after revocation | HMAC tokens are stateless; rotating `REACH_SECRET` invalidates all in-flight tokens |
| Application | UI injection | React's default escaping + only-self CSP |
| Application | Clickjacking | `X-Frame-Options: SAMEORIGIN`, CSP `frame-ancestors 'self'` |
| Application | MITM | HSTS one-year header (`Strict-Transport-Security: max-age=31536000; includeSubDomains`) |
| Application | Information leakage | `Referrer-Policy: strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff`, restrictive `Permissions-Policy` |
| Container / host | Privileged escalation | Both containers run as non-root from their base images; no host-network mode |

## Authentication

* **Login** — `POST /api/auth/login` with `{username, password}`. Passwords are verified with `bcrypt.checkpw` against the per-user hash. On success the response is `{ token, username, expires_at }`. On failure: 401.
* **Bearer token** — `username.expiry.hmac_sha256(SECRET, "username.expiry")`. Tokens are stateless (no DB); the signature is the only thing required to verify.
* **Refresh** — `POST /api/auth/refresh` accepts a token that's still valid OR within `REACH_REFRESH_GRACE` (default 1h) of expiry, and issues a fresh one. Beyond that window → 401.
* **`/api/auth/me`** — checks the bearer header and echoes the verified username.

## Authorisation

There is one role: authenticated. All data routes use:

```python
PROTECTED = Depends(current_user)
app.include_router(api.router, prefix="/api", dependencies=[PROTECTED])
```

`/api/health` is intentionally unauthenticated so container healthchecks succeed.

## Password storage

Passwords are stored as bcrypt hashes (cost 12). Configure via env:

```bash
# Option A: multiple users (preferred)
export REACH_USERS_JSON='{"alice":"$2b$12$abcdef…","bob":"$2b$12$ghijkl…"}'

# Option B: single user
export REACH_USER=admin
export REACH_PASS='$2b$12$abcdef…'   # already hashed
# OR plain — the loader hashes once on container start:
export REACH_PASS='my-strong-pass'
```

Generate a hash:

```python
import bcrypt
print(bcrypt.hashpw(b"my-strong-pass", bcrypt.gensalt(rounds=12)).decode())
```

## Rate limiting

Login attempts are limited per `(client_ip, username)`:

* `REACH_LOGIN_MAX` = 8 failed attempts (default)
* `REACH_LOGIN_WINDOW` = 600 seconds (default; 10 minutes)

Successful logins reset the counter. The implementation is in-process (`dict[(ip, user), deque[float]]`); adequate for a single backend replica. For multi-replica deploys, replace `_is_rate_limited` / `_record_fail` / `_clear_fails` in `routes/auth.py` with Redis-backed counters.

## CORS

`CORS_ORIGINS` accepts a comma-separated list. The default is the two local Vite/Nginx ports. **Set this to your public origin in production** — never use `*` with credentials.

## Transport security

The Docker stack ships HTTP only; **terminate TLS in front** with a reverse proxy (nginx, Caddy, Traefik, cloud LB). The app emits `Strict-Transport-Security` so once a browser sees the TLS site it sticks.

## Browser security headers (set by Nginx)

| Header | Value | Reason |
|---|---|---|
| `Content-Security-Policy` | `default-src 'self'; img-src 'self' data: blob: https://*.basemaps.cartocdn.com https://*.openstreetmap.org; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; font-src 'self' data:; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'` | Limit XSS surface. Map tiles are allowed from CARTO/OSM only. |
| `X-Frame-Options` | `SAMEORIGIN` | Anti-clickjacking |
| `X-Content-Type-Options` | `nosniff` | MIME-sniff protection |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Don't leak full URLs |
| `Permissions-Policy` | `geolocation=(), microphone=(), camera=(), payment=()` | Disable unused features |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | HSTS one-year |

Headers are repeated per-location in `nginx.conf` because nginx's `add_header` does NOT inherit through location-scope `add_header`.

## Secrets

* `REACH_SECRET` — HMAC key. **Must be changed from default** in any production deploy. A leaked secret means anyone can forge tokens.
* Source `.env` files are gitignored. Use the cluster's secrets manager (e.g., AWS Secrets Manager, GCP Secret Manager, Kubernetes Secret) in production.

## Vulnerability reporting

Email [info@ehealthafrica.org](mailto:info@ehealthafrica.org) with a description and a minimal reproduction. We aim to acknowledge within two business days.

## Known limitations

* Rate-limit state is in-process (not shared across replicas).
* No CSRF token — the API is bearer-token-only and not cookie-authed, so cross-site form submission can't carry the token. If we ever introduce cookie auth, CSRF protection must be added.
* No audit log table yet (planned).
