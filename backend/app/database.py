"""SQLite connection helpers. SpatiaLite extension is loaded when available
so the DB has geospatial ability per the spec, but the API only relies on
GeoJSON columns — spatial queries are not needed for the current dashboards."""
from __future__ import annotations

import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

DB_PATH = os.environ.get("DB_PATH", str(Path(__file__).resolve().parent.parent / "data" / "reach.db"))

SPATIALITE_LIB_CANDIDATES = [
    "mod_spatialite",
    "mod_spatialite.so",
    "/usr/lib/x86_64-linux-gnu/mod_spatialite.so",
]


def _try_load_spatialite(conn: sqlite3.Connection) -> bool:
    try:
        conn.enable_load_extension(True)
    except (AttributeError, sqlite3.OperationalError):
        return False
    for lib in SPATIALITE_LIB_CANDIDATES:
        try:
            conn.load_extension(lib)
            return True
        except sqlite3.OperationalError:
            continue
    return False


def connect(read_only: bool = False) -> sqlite3.Connection:
    Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    if read_only:
        uri = f"file:{DB_PATH}?mode=ro"
        conn = sqlite3.connect(uri, uri=True)
    else:
        conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    _try_load_spatialite(conn)
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


@contextmanager
def get_conn(read_only: bool = False):
    conn = connect(read_only=read_only)
    try:
        yield conn
    finally:
        conn.close()


SCHEMA = """
CREATE TABLE IF NOT EXISTS treatments (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    sn              INTEGER,
    year            INTEGER,
    country         TEXT NOT NULL,
    state           TEXT,
    lga             TEXT,
    conc            TEXT,
    match_spatial   TEXT,
    spatial_state   TEXT,
    spatial_state_plain TEXT,
    children_treated   INTEGER,
    children_eligible  INTEGER,
    treated_fg      REAL,
    death_averted   REAL,
    severe_adverse_event INTEGER,
    rounds          INTEGER,
    quarter         TEXT,
    quarter_measure TEXT,
    quarter_label   TEXT,
    country25       TEXT
);
CREATE INDEX IF NOT EXISTS ix_treatments_country ON treatments(country);
CREATE INDEX IF NOT EXISTS ix_treatments_year ON treatments(year);
CREATE INDEX IF NOT EXISTS ix_treatments_quarter ON treatments(quarter_label);
CREATE INDEX IF NOT EXISTS ix_treatments_rounds ON treatments(rounds);
CREATE INDEX IF NOT EXISTS ix_treatments_state ON treatments(spatial_state);

CREATE TABLE IF NOT EXISTS boundaries (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    country         TEXT NOT NULL,
    admin_level     INTEGER NOT NULL,
    name            TEXT NOT NULL,
    name_upper      TEXT NOT NULL,
    parent          TEXT,
    geojson         TEXT NOT NULL,
    UNIQUE(country, admin_level, name_upper)
);
CREATE INDEX IF NOT EXISTS ix_boundaries_country ON boundaries(country);
CREATE INDEX IF NOT EXISTS ix_boundaries_level ON boundaries(admin_level);

CREATE TABLE IF NOT EXISTS scheduled_reports (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    email       TEXT NOT NULL,
    scope       TEXT,
    format      TEXT,
    cadence     TEXT,
    send_time   TEXT,
    timezone    TEXT,
    created_at  TEXT DEFAULT CURRENT_TIMESTAMP,
    last_sent   TEXT
);

CREATE TABLE IF NOT EXISTS alerts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    email       TEXT NOT NULL,
    metric      TEXT NOT NULL,
    comparison  TEXT NOT NULL,
    threshold   REAL NOT NULL,
    scope       TEXT,
    created_at  TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS feedback (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    kind        TEXT NOT NULL,           -- bug / feature / data / general
    subject     TEXT NOT NULL,
    message     TEXT NOT NULL,
    email       TEXT,
    username    TEXT,
    page        TEXT,
    created_at  TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_feedback_created ON feedback(created_at);
"""


def initialize_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(SCHEMA)
    conn.commit()
