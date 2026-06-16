# Deployment

This guide covers production deployment of the REACH Regional Dashboard.

## Hardware

A single 2 vCPU / 4 GB RAM node comfortably handles the workload (data set ~170k rows, ~70 polygons; SQLite memory-resident). Disk needs ~200 MB for the DB + ~50 MB for assets.

## Topology (recommended)

```
            ┌─────────────────────┐
Public TLS  │  Cloud LB / Caddy /  │
   ────────►│  nginx (TLS termin.) │
            └──────────┬───────────┘
                       │ http
            ┌──────────┴───────────┐
            │ docker compose       │
            │  ┌──────────┐        │
            │  │ frontend │ :80    │
            │  └────┬─────┘        │
            │       │              │
            │  ┌────┴─────┐        │
            │  │ backend  │ :8000  │
            │  └──────────┘        │
            └──────────────────────┘
```

## 1. Provision

```bash
# Ubuntu 24.04 example
sudo apt-get update && sudo apt-get install -y docker.io docker-compose-v2 git
sudo usermod -aG docker $USER
newgrp docker
```

## 2. Clone & configure

```bash
git clone https://github.com/eHealthAfrica/REACH-DASHBOARD.git
cd REACH-DASHBOARD

# Place source data alongside docker-compose.yml:
#   Dami Action_MAIN1.xlsx
#   gadm41_NGA_shp/
#   gadm41_NER_shp/
#   gadm41_MLI_shp/

# Set production environment
cp backend/.env.example backend/.env
$EDITOR backend/.env
```

Production `.env` must change at least:

```bash
CORS_ORIGINS=https://dashboard.example.org
REACH_AUTH_OPTIONAL=0
REACH_USERS_JSON={"reach-admin":"$2b$12$your-real-hash-here"}
REACH_SECRET=$(openssl rand -base64 32)
```

To wire `backend/.env` into the compose stack, add `env_file` to the backend service in `docker-compose.yml`:

```yaml
  backend:
    env_file:
      - backend/.env
```

## 3. Build and start

```bash
docker compose up -d --build
docker compose ps        # confirm both Healthy
docker compose logs -f --tail=50
```

The first start runs ingestion; subsequent starts skip it (unless `FORCE_REINGEST=1`).

## 4. TLS termination (Caddy example)

Caddyfile on the host:

```
dashboard.example.org {
  reverse_proxy localhost:3000
  encode zstd gzip
  header {
    Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
    -Server
  }
}
```

```bash
sudo apt install -y caddy
sudo systemctl restart caddy
```

Caddy auto-fetches a Let's Encrypt cert. The dashboard's own `Strict-Transport-Security` header still applies behind it.

## 5. Backups

```bash
# Daily SQLite dump (cron @ 02:00)
0 2 * * * cd /opt/reach && docker compose exec -T backend \
  sqlite3 /app/data/reach.db ".backup '/app/data/reach.$(date +\%F).db'"
```

## 6. Updates

```bash
git pull
docker compose build
docker compose up -d   # healthchecks gate the rollover
```

For a no-downtime update behind a load balancer, run two backend replicas and rotate them; SQLite is read-only at runtime, so contention is not a concern.

## 7. Monitoring

* **Prometheus** — scrape `/metrics` directly:

  ```yaml
  scrape_configs:
    - job_name: reach
      metrics_path: /metrics
      static_configs:
        - targets: ['backend:8000']
  ```

* **Healthchecks** — Docker exposes them via `docker inspect`; surface to your orchestrator (k8s, ECS) using their native liveness/readiness probe support.

* **Logs** — `docker compose logs` is fine for one box. For a fleet, point Docker's log driver at your stack (Loki, CloudWatch, Splunk).

## 8. Rotating secrets

```bash
# 1. Generate a new HMAC key
NEW=$(openssl rand -base64 32)
# 2. Update .env, restart backend (this invalidates every in-flight token)
sed -i "s|^REACH_SECRET=.*|REACH_SECRET=$NEW|" backend/.env
docker compose up -d backend
```

All users will be bounced to `/login`.

## 9. Disaster recovery

```bash
# Restore from the most recent backup
docker compose down
cp backend/data/reach.<DATE>.db backend/data/reach.db
docker compose up -d
```

If the Excel source is lost too, re-ingest from your last good copy:

```bash
docker compose exec backend python -m app.ingest.load_data
```

## Troubleshooting

* **Backend unhealthy on first boot** — Excel mount path mismatch. Check `docker compose logs backend` for the ingest line; it must show your file path.
* **403/429 from `/api/auth/login`** — rate-limit was hit. Wait 10 minutes or relax `REACH_LOGIN_MAX`.
* **Map tiles 404** — CSP blocks an unexpected origin. Add the origin to the `img-src` clause in `frontend/nginx.conf`.
