"""AI-style insights, sparklines, KPI deltas, NL chat, scheduled reports & alerts.

The "AI" here is a deterministic rule engine over the aggregated data — fast,
free, and predictable. To wire a real LLM, swap `_compose_*` to call your
provider and pass the same context dict.
"""
from __future__ import annotations

import re
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, EmailStr

from ..database import get_conn

router = APIRouter()

VALID_COUNTRIES = {"NIGERIA", "NIGER", "MALI"}
METRICS = {"percentage", "treated", "eligible", "sae", "deaths"}


def _round_pct(num: int, den: int) -> int:
    """Coverage percentages are integers."""
    return int(round((num / den) * 100)) if den else 0


def _quarter_sort_key(q: str):
    parts = (q or "").split()
    if len(parts) == 2 and parts[0].startswith("Q"):
        try: return (int(parts[1]), int(parts[0][1:]))
        except ValueError: return (9999, 9)
    return (9999, 9)


def _where(country, year, quarter, round_, state=None, lga=None):
    clauses, params = [], []
    if country: clauses.append("country = ?"); params.append(country.upper())
    if year is not None: clauses.append("year = ?"); params.append(year)
    if quarter: clauses.append("quarter_label = ?"); params.append(quarter)
    if round_ is not None: clauses.append("rounds = ?"); params.append(round_)
    if state: clauses.append("spatial_state = ?"); params.append(state.upper())
    if lga: clauses.append("lga = ?"); params.append(lga.upper())
    return (" WHERE " + " AND ".join(clauses)) if clauses else "", params


def _norm_country(c):
    if not c: return None
    cu = c.strip().upper()
    if cu in {"ALL", "REGIONAL", ""}: return None
    if cu not in VALID_COUNTRIES: raise HTTPException(400, f"Unknown country: {c}")
    return cu


# ---------------------------------------------------------------------------
@router.get("/sparkline")
def sparkline(
    country: Optional[str] = None,
    state: Optional[str] = None,
    lga: Optional[str] = None,
    last_n: int = Query(6, ge=2, le=24),
):
    c = _norm_country(country)
    where, params = _where(c, None, None, None, state=state, lga=lga)
    with get_conn(read_only=True) as conn:
        rows = conn.execute(f"""
            SELECT quarter_label AS q,
                   COALESCE(SUM(children_eligible),0) AS eligible,
                   COALESCE(SUM(children_treated),0)  AS treated,
                   COALESCE(SUM(severe_adverse_event),0) AS sae,
                   COALESCE(SUM(death_averted),0) AS deaths
            FROM treatments{where}
            GROUP BY quarter_label
        """, params).fetchall()
    points = sorted(
        ({
            "quarter": r["q"],
            "eligible": int(r["eligible"]),
            "treated": int(r["treated"]),
            "percentage": _round_pct(int(r["treated"]), int(r["eligible"])),
            "sae": int(r["sae"] or 0),
            "deaths": int(r["deaths"] or 0),
        } for r in rows if r["q"]),
        key=lambda p: _quarter_sort_key(p["quarter"]),
    )
    return points[-last_n:]


# ---------------------------------------------------------------------------
@router.get("/kpi-deltas")
def kpi_deltas(
    country: Optional[str] = None,
    state: Optional[str] = None,
    lga: Optional[str] = None,
):
    """Returns latest quarter snapshot vs previous quarter for each KPI."""
    series = sparkline(country=country, state=state, lga=lga, last_n=24)
    if not series:
        return {"current": None, "previous": None, "deltas": None}
    cur = series[-1]
    prev = series[-2] if len(series) >= 2 else None
    def d(k, prefer="abs"):
        c = cur.get(k, 0); p = (prev or {}).get(k, 0)
        diff = c - p
        pct = ((c - p) / p * 100) if p else (100 if c else 0)
        return {"current": c, "previous": p, "delta": diff, "delta_pct": int(round(pct))}
    return {
        "quarter": cur.get("quarter"),
        "previous_quarter": (prev or {}).get("quarter"),
        "eligible": d("eligible"),
        "treated": d("treated"),
        "percentage": d("percentage"),
        "sae": d("sae"),
        "deaths": d("deaths"),
    }


# ---------------------------------------------------------------------------
def _fmt(n):
    try:    return f"{int(n):,}"
    except: return str(n)


def _compose_kpi_insight(scope_label, metric, payload):
    if not payload:
        return f"No data yet for {scope_label}."
    series = payload["series"]
    if not series:
        return f"No recent data for {scope_label}."
    cur, prev = series[-1], (series[-2] if len(series) >= 2 else None)
    qcur = cur["quarter"]; qprev = (prev or {}).get("quarter")
    label_map = {
        "eligible": "Children Eligible",
        "treated":  "Children Treated",
        "percentage": "Percentage Treated",
        "sae": "Severe Adverse Effects",
        "deaths": "Estimated Deaths Averted",
    }
    label = label_map.get(metric, metric)

    if metric == "percentage":
        val_cur  = cur.get("percentage", 0)
        if prev:
            val_prev = prev.get("percentage", 0)
            diff = round(val_cur - val_prev, 1)
            direction = "rose" if diff > 0 else ("fell" if diff < 0 else "stayed flat")
            out = (f"{label} for {scope_label} is {val_cur}% in {qcur}, "
                   f"{direction} by {abs(diff)} pts versus {qprev} ({val_prev}%).")
        else:
            out = f"{label} for {scope_label} is {val_cur}% in {qcur}."
        # min/max
        peak = max(series, key=lambda p: p["percentage"])
        trough = min(series, key=lambda p: p["percentage"])
        out += f" Peak in the window: {peak['percentage']}% ({peak['quarter']})."
        return out

    if metric in {"eligible", "treated", "sae", "deaths"}:
        val_cur = cur.get(metric, 0)
        if prev:
            val_prev = prev.get(metric, 0)
            diff = val_cur - val_prev
            pct = round((diff / val_prev * 100), 1) if val_prev else 0
            direction = "up" if diff > 0 else ("down" if diff < 0 else "flat")
            out = (f"{label} for {scope_label} is {_fmt(val_cur)} in {qcur}, "
                   f"{direction} {abs(pct)}% vs {qprev} ({_fmt(val_prev)}).")
        else:
            out = f"{label} for {scope_label} is {_fmt(val_cur)} in {qcur}."
        return out
    return f"{label}: {cur.get(metric, '—')}"


@router.get("/insights")
def insights(
    metric: str = Query(...),
    country: Optional[str] = None,
    state: Optional[str] = None,
    lga: Optional[str] = None,
):
    if metric not in METRICS:
        raise HTTPException(400, "metric must be one of: " + ", ".join(METRICS))
    series = sparkline(country=country, state=state, lga=lga, last_n=8)
    scope = lga or state or country or "all countries"
    text = _compose_kpi_insight(scope.title(), metric, {"series": series})
    return {"metric": metric, "scope": scope, "narrative": text, "series": series}


# ---------------------------------------------------------------------------
# Natural-language chat
# ---------------------------------------------------------------------------
class ChatRequest(BaseModel):
    question: str
    country: Optional[str] = None
    state: Optional[str] = None
    lga: Optional[str] = None


def _detect_country(q: str) -> Optional[str]:
    for c in VALID_COUNTRIES:
        if re.search(rf"\b{c}\b", q, re.I): return c
    return None


def _detect_metric(q: str) -> str:
    s = q.lower()
    if any(k in s for k in ["coverage", "percentage", "% treated", "percent"]): return "percentage"
    if "eligible" in s: return "eligible"
    if "treated" in s or "treatment" in s: return "treated"
    if "adverse" in s or "sae" in s: return "sae"
    if "death" in s or "averted" in s: return "deaths"
    return "percentage"


def _answer(question: str, country=None, state=None, lga=None) -> dict:
    s = question.strip()
    if not s:
        return {"answer": "Ask me about coverage, eligible / treated children, adverse events or deaths averted — by country, state or LGA."}

    sl = s.lower()
    detected_country = country or _detect_country(s)
    metric = _detect_metric(s)
    scope = detected_country or "all countries"

    # "top/highest/lowest state/country/lga"
    rank = None
    if any(k in sl for k in ["highest", "top", "best"]): rank = "desc"
    elif any(k in sl for k in ["lowest", "worst", "bottom"]): rank = "asc"

    with get_conn(read_only=True) as conn:
        if rank and ("country" in sl or not detected_country):
            order = "DESC" if rank == "desc" else "ASC"
            row = conn.execute(f"""
                SELECT country,
                       COALESCE(SUM(children_eligible),0) AS e,
                       COALESCE(SUM(children_treated),0)  AS t
                FROM treatments GROUP BY country
                ORDER BY (CASE WHEN COALESCE(SUM(children_eligible),0)=0 THEN 0
                          ELSE 1.0 * COALESCE(SUM(children_treated),0)
                               / COALESCE(SUM(children_eligible),0) END) {order}
                LIMIT 1
            """).fetchone()
            if row:
                pct = _round_pct(int(row["t"]), int(row["e"]))
                rank_word = "highest" if rank == "desc" else "lowest"
                return {"answer": f"{row['country'].title()} has the {rank_word} coverage at {pct}% "
                                  f"({_fmt(row['t'])} of {_fmt(row['e'])} eligible children)."}
        if rank and detected_country and ("state" in sl or "region" in sl or "lga" in sl):
            group = "lga" if "lga" in sl else "spatial_state"
            order = "DESC" if rank == "desc" else "ASC"
            row = conn.execute(f"""
                SELECT {group} AS name,
                       COALESCE(SUM(children_eligible),0) AS e,
                       COALESCE(SUM(children_treated),0)  AS t
                FROM treatments WHERE country=? GROUP BY {group}
                ORDER BY (CASE WHEN COALESCE(SUM(children_eligible),0)=0 THEN 0
                          ELSE 1.0 * COALESCE(SUM(children_treated),0)
                               / COALESCE(SUM(children_eligible),0) END) {order}
                LIMIT 1
            """, (detected_country,)).fetchone()
            if row:
                pct = _round_pct(int(row["t"]), int(row["e"]))
                rank_word = "highest" if rank == "desc" else "lowest"
                what = "LGA" if group == "lga" else "state"
                return {"answer": f"In {detected_country.title()}, {row['name'].title()} has the "
                                  f"{rank_word} coverage at {pct}% ({_fmt(row['t'])} of {_fmt(row['e'])})."}

        # Trend / latest snapshot
        if "trend" in sl or "over time" in sl or "recent" in sl or "latest" in sl:
            series = sparkline(country=detected_country, state=state, lga=lga, last_n=6)
            if series:
                cur, prev = series[-1], (series[-2] if len(series) >= 2 else None)
                base = f"In {cur['quarter']}, coverage for {scope.title()} was {cur['percentage']}%."
                if prev:
                    diff = round(cur["percentage"] - prev["percentage"], 1)
                    direction = "up" if diff > 0 else ("down" if diff < 0 else "flat")
                    base += f" That is {direction} by {abs(diff)} pts vs {prev['quarter']} ({prev['percentage']}%)."
                return {"answer": base}

        # Fallback — KPI summary
        params = []; where = ""
        if detected_country: where = " WHERE country=?"; params.append(detected_country)
        row = conn.execute(f"""
            SELECT COALESCE(SUM(children_eligible),0) AS e,
                   COALESCE(SUM(children_treated),0)  AS t,
                   COALESCE(SUM(severe_adverse_event),0) AS sae,
                   COALESCE(SUM(death_averted),0) AS deaths
            FROM treatments{where}
        """, params).fetchone()
        e, t = int(row["e"]), int(row["t"])
        pct = _round_pct(t, e)
        return {"answer": f"For {scope.title()}: {_fmt(t)} of {_fmt(e)} eligible children treated ({pct}%). "
                          f"Severe adverse effects: {row['sae']}. Estimated deaths averted: {_fmt(row['deaths'])}."}


@router.post("/chat")
def chat(req: ChatRequest):
    res = _answer(req.question, country=req.country, state=req.state, lga=req.lga)
    return res


# ---------------------------------------------------------------------------
# Scheduled reports
# ---------------------------------------------------------------------------
from typing import List


class ReportRequest(BaseModel):
    emails: List[EmailStr]
    scopes: List[str] = ["REGIONAL"]
    format: str = "pdf"
    cadence: str = "weekly"
    send_time: Optional[str] = "08:00"   # HH:MM, 24-hour
    timezone:  Optional[str] = "Africa/Lagos"


@router.get("/reports")
def list_reports():
    with get_conn(read_only=True) as conn:
        rows = conn.execute("SELECT * FROM scheduled_reports ORDER BY created_at DESC").fetchall()
    return [dict(r) for r in rows]


@router.post("/reports")
def create_report(req: ReportRequest):
    if req.format not in {"csv", "pdf", "pptx", "docx"}:
        raise HTTPException(400, "format must be csv, pdf, pptx, or docx")
    if req.cadence not in {"daily", "weekly", "monthly"}:
        raise HTTPException(400, "cadence must be daily, weekly, or monthly")
    if not req.emails:
        raise HTTPException(400, "at least one email is required")
    if not req.scopes:
        req.scopes = ["REGIONAL"]
    emails_csv = ",".join([str(e) for e in req.emails])
    scopes_csv = ",".join([s.upper() for s in req.scopes])
    with get_conn() as conn:
        conn.execute("""
            INSERT INTO scheduled_reports
                (email, scope, format, cadence, send_time, timezone)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (emails_csv, scopes_csv, req.format, req.cadence,
              req.send_time, req.timezone))
        conn.commit()
        last = conn.execute("SELECT last_insert_rowid() AS id").fetchone()["id"]
    return {"id": last, "queued": True,
            "emails": req.emails, "scopes": req.scopes,
            "send_time": req.send_time, "timezone": req.timezone,
            "note": "SMTP is not configured in this build; the schedule is persisted "
                    "and will be delivered once outbound email is wired."}


@router.delete("/reports/{id}")
def delete_report(id: int):
    with get_conn() as conn:
        conn.execute("DELETE FROM scheduled_reports WHERE id = ?", (id,)); conn.commit()
    return {"ok": True}


# ---------------------------------------------------------------------------
# Alerts
# ---------------------------------------------------------------------------
class AlertRequest(BaseModel):
    email: EmailStr
    metric: str
    comparison: str
    threshold: float
    scope: Optional[str] = None


@router.get("/alerts")
def list_alerts():
    with get_conn(read_only=True) as conn:
        rows = conn.execute("SELECT * FROM alerts ORDER BY created_at DESC").fetchall()
    return [dict(r) for r in rows]


@router.post("/alerts")
def create_alert(req: AlertRequest):
    if req.metric not in METRICS:
        raise HTTPException(400, "metric must be one of " + ", ".join(METRICS))
    if req.comparison not in {"lt", "gt", "eq"}:
        raise HTTPException(400, "comparison must be lt, gt, or eq")
    with get_conn() as conn:
        conn.execute("""
            INSERT INTO alerts (email, metric, comparison, threshold, scope)
            VALUES (?, ?, ?, ?, ?)
        """, (req.email, req.metric, req.comparison, req.threshold,
              (req.scope or "REGIONAL").upper()))
        conn.commit()
        last = conn.execute("SELECT last_insert_rowid() AS id").fetchone()["id"]
    return {"id": last, "armed": True,
            "note": "SMTP is not configured in this build; the alert is persisted."}


@router.delete("/alerts/{id}")
def delete_alert(id: int):
    with get_conn() as conn:
        conn.execute("DELETE FROM alerts WHERE id = ?", (id,)); conn.commit()
    return {"ok": True}


# ---------------------------------------------------------------------------
# Feedback (queries / bug reports / feature requests)
# ---------------------------------------------------------------------------
class FeedbackRequest(BaseModel):
    kind: str           # "bug" / "feature" / "data" / "general"
    subject: str
    message: str
    email: Optional[EmailStr] = None
    username: Optional[str] = None
    page: Optional[str] = None


@router.get("/feedback")
def list_feedback(limit: int = 100):
    """Admin-style read; returns the latest N feedback entries."""
    with get_conn(read_only=True) as conn:
        rows = conn.execute("""
            SELECT id, kind, subject, message, email, username, page, created_at
            FROM feedback ORDER BY created_at DESC LIMIT ?
        """, (max(1, min(limit, 500)),)).fetchall()
    return [dict(r) for r in rows]


@router.post("/feedback")
def create_feedback(req: FeedbackRequest):
    if req.kind not in {"bug", "feature", "data", "general"}:
        raise HTTPException(400, "kind must be bug, feature, data, or general")
    subj = (req.subject or "").strip()
    msg  = (req.message or "").strip()
    if not subj or not msg:
        raise HTTPException(400, "subject and message are required")
    with get_conn() as conn:
        conn.execute("""
            INSERT INTO feedback (kind, subject, message, email, username, page)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (req.kind, subj[:200], msg[:4000], req.email, req.username, (req.page or "")[:120]))
        conn.commit()
        last = conn.execute("SELECT last_insert_rowid() AS id").fetchone()["id"]
    return {"id": last, "received": True,
            "note": "Persisted; the REACH team will review and respond if a follow-up is needed."}


# ---------------------------------------------------------------------------
# What-If simulator
# ---------------------------------------------------------------------------
class WhatIfRequest(BaseModel):
    country: Optional[str] = None
    state: Optional[str] = None
    lga: Optional[str] = None
    coverage_uplift_pct: float = 0   # uplifts current coverage by N pts (capped at 100%)
    reporting_uplift_pct: float = 0  # +N% to reported eligibles (data completeness)
    staff_uplift_pct: float = 0      # +N% throughput on treated
    facility_uplift_pct: float = 0   # +N% additional reach


@router.post("/whatif")
def whatif(req: WhatIfRequest):
    c = _norm_country(req.country)
    where, params = _where(c, None, None, None, state=req.state, lga=req.lga)
    with get_conn(read_only=True) as conn:
        row = conn.execute(f"""
            SELECT COALESCE(SUM(children_eligible),0) AS eligible,
                   COALESCE(SUM(children_treated),0)  AS treated,
                   COALESCE(SUM(severe_adverse_event),0) AS sae,
                   COALESCE(SUM(death_averted),0) AS deaths
            FROM treatments{where}
        """, params).fetchone()
    base_e = int(row["eligible"] or 0)
    base_t = int(row["treated"] or 0)
    base_pct = _round_pct(base_t, base_e)

    # Project
    proj_e = base_e * (1 + req.reporting_uplift_pct / 100.0)
    throughput = 1 + (req.staff_uplift_pct + req.facility_uplift_pct) / 100.0
    proj_t = base_t * throughput
    # apply absolute coverage uplift if user asked
    if req.coverage_uplift_pct:
        proj_pct_capped = min(100.0, base_pct + req.coverage_uplift_pct)
        proj_t = max(proj_t, proj_e * proj_pct_capped / 100.0)
    proj_t = min(proj_t, proj_e)  # can't treat more than eligible
    proj_pct = round((proj_t / proj_e * 100), 1) if proj_e else 0.0

    # naive deaths-averted estimate proportional to treated
    deaths_factor = (int(row["deaths"] or 0) / base_t) if base_t else 0.001
    proj_deaths = round(proj_t * deaths_factor, 0)

    return {
        "baseline": {
            "eligible": base_e, "treated": base_t,
            "percentage": base_pct, "deaths_averted": int(row["deaths"] or 0),
        },
        "projection": {
            "eligible": int(round(proj_e)),
            "treated":  int(round(proj_t)),
            "percentage": proj_pct,
            "deaths_averted": int(proj_deaths),
        },
        "delta": {
            "treated_extra": int(round(proj_t - base_t)),
            "percentage_pts": round(proj_pct - base_pct, 1),
            "deaths_extra": int(proj_deaths - int(row["deaths"] or 0)),
        },
        "scenario": {
            "coverage_uplift_pct": req.coverage_uplift_pct,
            "reporting_uplift_pct": req.reporting_uplift_pct,
            "staff_uplift_pct": req.staff_uplift_pct,
            "facility_uplift_pct": req.facility_uplift_pct,
        },
    }


# ---------------------------------------------------------------------------
# Smart Recommendations
# ---------------------------------------------------------------------------
@router.get("/recommendations")
def recommendations(country: Optional[str] = None):
    c = _norm_country(country)
    recs = []
    with get_conn(read_only=True) as conn:
        if c is None:
            rows = conn.execute("""
                SELECT country,
                       COALESCE(SUM(children_eligible),0) AS e,
                       COALESCE(SUM(children_treated),0)  AS t
                FROM treatments GROUP BY country
            """).fetchall()
            ranked = sorted([
                {"country": r["country"], "pct": _round_pct(int(r["t"]), int(r["e"]))}
                for r in rows], key=lambda x: x["pct"])
            if ranked:
                lo = ranked[0]
                if lo["pct"] < 90:
                    recs.append({
                        "level": "high",
                        "title": f"Boost coverage in {lo['country'].title()}",
                        "detail": f"Coverage is {lo['pct']}%, below the 90% target. Review supply chain and reporting completeness for the next round.",
                    })
                hi = ranked[-1]
                if hi["pct"] >= 95:
                    recs.append({
                        "level": "info",
                        "title": f"Replicate playbook from {hi['country'].title()}",
                        "detail": f"Achieved {hi['pct']}% coverage — document the operational practices and share with lower-coverage teams.",
                    })
        else:
            # Country-specific: top/bottom state, trend, SAE flag
            series = sparkline(country=c, last_n=6)
            if len(series) >= 2:
                cur, prev = series[-1], series[-2]
                if cur["percentage"] < prev["percentage"] - 3:
                    recs.append({
                        "level": "high",
                        "title": f"Coverage dropped in {cur['quarter']}",
                        "detail": f"{c.title()} fell from {prev['percentage']}% to {cur['percentage']}% in one quarter. "
                                  f"Investigate logistics, reporting delays, or campaign gaps.",
                    })
            states = conn.execute("""
                SELECT spatial_state AS s,
                       COALESCE(SUM(children_eligible),0) AS e,
                       COALESCE(SUM(children_treated),0)  AS t,
                       COALESCE(SUM(severe_adverse_event),0) AS sae
                FROM treatments WHERE country=? GROUP BY spatial_state
            """, (c,)).fetchall()
            ranked = sorted([
                {"state": r["s"], "pct": _round_pct(int(r["t"]), int(r["e"])), "sae": int(r["sae"] or 0)}
                for r in states if r["s"]], key=lambda x: x["pct"])
            if ranked:
                lo = ranked[0]
                if lo["pct"] < 85:
                    recs.append({
                        "level": "medium",
                        "title": f"{lo['state'].title()} is lagging",
                        "detail": f"Lowest state coverage in {c.title()} at {lo['pct']}%. Consider targeted mop-up rounds.",
                    })
            sae_hot = [r for r in ranked if r["sae"] > 0]
            if sae_hot:
                recs.append({
                    "level": "high",
                    "title": "Severe adverse events reported",
                    "detail": f"{len(sae_hot)} state(s) reported SAEs. Verify pharmacovigilance follow-up and triage.",
                })
            if not recs:
                recs.append({
                    "level": "info",
                    "title": f"{c.title()} on track",
                    "detail": "No anomalies detected in the current window. Maintain monitoring cadence.",
                })
    return recs
