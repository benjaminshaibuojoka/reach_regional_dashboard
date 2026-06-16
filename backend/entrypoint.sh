#!/usr/bin/env bash
set -e

DB_PATH="${DB_PATH:-/app/data/reach.db}"

if [ ! -f "$DB_PATH" ] || [ "${FORCE_REINGEST:-0}" = "1" ]; then
  echo "[entrypoint] Ingesting data into $DB_PATH ..."
  python -m app.ingest.load_data || {
    echo "[entrypoint] Ingestion failed. Backend will still start so you can debug via /api/health."
  }
else
  echo "[entrypoint] DB already exists at $DB_PATH (set FORCE_REINGEST=1 to rebuild)."
fi

exec uvicorn app.main:app --host 0.0.0.0 --port 8000
