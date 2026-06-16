"""One-shot ingestion: Excel -> treatments table, Shapefiles -> boundaries table.

Run inside the backend container via:
    python -m app.ingest.load_data

Configured by env vars:
    DB_PATH      — destination SQLite file
    EXCEL_PATH   — path to Dami Action_MAIN11.xlsx
    SHP_NGA      — path to gadm41_NGA_shp directory
    SHP_NER      — path to gadm41_NER_shp directory
    SHP_MLI      — path to gadm41_MLI_shp directory
"""
from __future__ import annotations

import json
import os
from pathlib import Path

import pandas as pd
import shapefile  # pyshp
from shapely.geometry import shape
from shapely.ops import unary_union

from ..database import connect, initialize_schema

EXCEL_PATH = os.environ.get("EXCEL_PATH", "/data_sources/Dami Action_MAIN11.xlsx")
SHP_DIRS = {
    # country: (path, admin-1 basename, admin-2 basename)
    "NIGERIA": (os.environ.get("SHP_NGA", "/data_sources/gadm41_NGA_shp"), "gadm41_NGA_1", "gadm41_NGA_2"),
    "NIGER":   (os.environ.get("SHP_NER", "/data_sources/gadm41_NER_shp"), "gadm41_NER_1", "gadm41_NER_2"),
    "MALI":    (os.environ.get("SHP_MLI", "/data_sources/gadm41_MLI_shp"), "gadm41_MLI_1", "gadm41_MLI_2"),
}

EXCEL_COLUMN_MAP = {
    "S/N": "sn",
    "YEAR": "year",
    "COUNTRY": "country",
    "STATE": "state",
    "LGA": "lga",
    "CONC": "conc",
    "MATCH SPATIAL": "match_spatial",
    "SPATIAL STATE": "spatial_state",
    "SPATIAL STATE PLAIN": "spatial_state_plain",
    "CHILDREN TREATED": "children_treated",
    "CHILDREN ELIGIBLE": "children_eligible",
    "TREATED(F/G)_": "treated_fg",
    "DEATH AVERTED": "death_averted",
    "SEVERE ADVERSE EVENT": "severe_adverse_event",
    "ROUNDS": "rounds",
    "QUARTER": "quarter",
    "QUARTER MEASURE": "quarter_measure",
    "QUARTER LABEL": "quarter_label",
    "COUNTRY25": "country25",
}


def load_treatments(conn) -> int:
    if not Path(EXCEL_PATH).exists():
        print(f"[ingest] Excel file missing at {EXCEL_PATH}; skipping treatments load.")
        return 0
    print(f"[ingest] Reading Excel: {EXCEL_PATH}")
    df = pd.read_excel(EXCEL_PATH, sheet_name=0, engine="openpyxl")
    df = df.rename(columns={k: v for k, v in EXCEL_COLUMN_MAP.items() if k in df.columns})
    keep = list(EXCEL_COLUMN_MAP.values())
    df = df[[c for c in keep if c in df.columns]]

    for col in ("children_treated", "children_eligible", "severe_adverse_event", "rounds", "year", "sn"):
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0).astype("int64")
    for col in ("treated_fg", "death_averted"):
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0)
    for col in ("country", "state", "lga", "spatial_state", "spatial_state_plain",
                "match_spatial", "conc", "quarter", "quarter_measure", "quarter_label", "country25"):
        if col in df.columns:
            df[col] = df[col].astype(str).str.strip().str.upper().replace({"NAN": None, "": None})

    # Drop rows missing the mandatory country tag — these would violate the
    # NOT NULL constraint and indicate row noise in the source file.
    before = len(df)
    df = df[df["country"].notna()]
    dropped = before - len(df)
    if dropped:
        print(f"[ingest] Skipped {dropped} rows with empty COUNTRY.")

    conn.execute("DELETE FROM treatments;")
    df.to_sql("treatments", conn, if_exists="append", index=False, chunksize=2000)
    conn.commit()
    n = conn.execute("SELECT COUNT(*) FROM treatments").fetchone()[0]
    print(f"[ingest] Loaded {n:,} treatment rows.")
    return n


def _read_shapes(shp_dir: str, basename: str):
    base = Path(shp_dir) / basename
    if not base.with_suffix(".shp").exists():
        return None
    reader = shapefile.Reader(str(base))
    fields = [f[0] for f in reader.fields[1:]]
    for sr in reader.shapeRecords():
        rec = dict(zip(fields, list(sr.record)))
        geo = sr.shape.__geo_interface__
        yield rec, geo
    reader.close()


def _simplify_geom(geom_dict, tolerance: float = 0.01):
    """Drop precision so we don't ship 200KB of decimals per polygon."""
    try:
        geom = shape(geom_dict)
        if not geom.is_valid:
            geom = geom.buffer(0)
        simplified = geom.simplify(tolerance, preserve_topology=True)
        return simplified.__geo_interface__
    except Exception:
        return geom_dict


def _load_level(conn, country, shp_dir, basename, admin_level, simplify_tol, name_col, parent_col):
    if not Path(shp_dir).exists():
        print(f"[ingest] Shapefile dir missing for {country}: {shp_dir}; skipping L{admin_level}.")
        return 0
    records = list(_read_shapes(shp_dir, basename) or [])
    if not records:
        print(f"[ingest] No shapes found for {country} at {shp_dir}/{basename}; skipping L{admin_level}.")
        return 0
    # Group polygons by (name, parent) so duplicated names under different parents are kept distinct.
    grouped: dict[tuple[str, str], list[dict]] = {}
    for rec, geo in records:
        name = (rec.get(name_col) or rec.get("VARNAME_" + name_col[-1]) or rec.get("NAME") or "").strip()
        if not name:
            continue
        parent = (rec.get(parent_col) or country).strip() if parent_col else country
        grouped.setdefault((name, parent), []).append(geo)
    n = 0
    for (name, parent), geoms in grouped.items():
        if len(geoms) == 1:
            geom = geoms[0]
        else:
            try:
                geom = unary_union([shape(g) for g in geoms]).__geo_interface__
            except Exception:
                geom = geoms[0]
        geom = _simplify_geom(geom, tolerance=simplify_tol)
        # Concat name+parent for uniqueness at L2 (multiple states have same LGA names elsewhere)
        key_upper = (f"{name}|{parent}".upper() if admin_level == 2 else name.upper())
        try:
            conn.execute(
                """INSERT OR REPLACE INTO boundaries
                   (country, admin_level, name, name_upper, parent, geojson)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (country, admin_level, name,
                 name.upper() if admin_level == 1 else name.upper(),
                 parent, json.dumps(geom)),
            )
            n += 1
        except Exception as e:
            print(f"[ingest] failed to insert {country}/{admin_level}/{name}: {e}")
    return n


def load_boundaries(conn) -> int:
    conn.execute("DELETE FROM boundaries;")
    total = 0
    for country, (shp_dir, basename1, basename2) in SHP_DIRS.items():
        n1 = _load_level(conn, country, shp_dir, basename1, admin_level=1,
                         simplify_tol=0.01, name_col="NAME_1", parent_col=None)
        print(f"[ingest] Loaded {n1} admin-1 polygons for {country}.")
        n2 = _load_level(conn, country, shp_dir, basename2, admin_level=2,
                         simplify_tol=0.005, name_col="NAME_2", parent_col="NAME_1")
        print(f"[ingest] Loaded {n2} admin-2 polygons for {country}.")
        total += n1 + n2
    conn.commit()
    print(f"[ingest] Boundaries total: {total}")
    return total


def main() -> None:
    conn = connect()
    try:
        initialize_schema(conn)
        load_treatments(conn)
        load_boundaries(conn)
        print("[ingest] Done.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
