"""Advanced analytics endpoints — international peer-standard methods.

- /forecast        Holt's linear trend with 80% / 95% prediction intervals
- /funnel          Eligible → Reached → Treated → Reported → Verified
- /cumulative      Cumulative coverage by round, per country
- /intensity-heatmap   States × rounds matrix coloured by coverage
- /retention       Round-on-round retention rate (treated_n+1 / treated_n)
- /methodology/{indicator}  Indicator definitions + denominator metadata
- /source-metadata Source + extraction / validation dates + version per country
"""
from __future__ import annotations

import math
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from ..database import get_conn

router = APIRouter()

VALID_COUNTRIES = {"NIGERIA", "NIGER", "MALI"}


def _norm(c):
    if not c: return None
    cu = c.strip().upper()
    if cu in {"ALL", "REGIONAL", ""}: return None
    if cu not in VALID_COUNTRIES: raise HTTPException(400, f"Unknown country: {c}")
    return cu


def _round_pct(num, den):
    return int(round((num / den) * 100)) if den else 0


def _round1(x):
    try: return round(float(x), 1)
    except: return 0.0


def _quarter_sort_key(q):
    parts = (q or "").split()
    if len(parts) == 2:
        if parts[0].startswith("Q"):
            try: return (int(parts[1]), int(parts[0][1:]))
            except ValueError: return (9999, 9)
        try: return (int(parts[0]), int(parts[1][1:]))
        except ValueError: return (9999, 9)
    return (9999, 9)


def _next_quarter(q, ahead=1):
    """Increment a "YYYY Qn" or "Qn YYYY" label by N quarters."""
    parts = (q or "").split()
    if len(parts) != 2:
        return q
    if parts[0].startswith("Q"):
        qnum, year = int(parts[0][1:]), int(parts[1])
        order = ("Q", "year")
    else:
        year, qnum = int(parts[0]), int(parts[1][1:])
        order = ("year", "Q")
    qnum += ahead
    while qnum > 4:
        qnum -= 4; year += 1
    while qnum < 1:
        qnum += 4; year -= 1
    return f"{year} Q{qnum}" if order[0] == "year" else f"Q{qnum} {year}"


def _historical_series(country, state=None, lga=None):
    clauses, params = [], []
    if country: clauses.append("country = ?"); params.append(country)
    if state:   clauses.append("spatial_state = ?"); params.append(state.upper())
    if lga:     clauses.append("lga = ?"); params.append(lga.upper())
    where = (" WHERE " + " AND ".join(clauses)) if clauses else ""
    with get_conn(read_only=True) as conn:
        rows = conn.execute(f"""
            SELECT quarter_label AS q,
                   COALESCE(SUM(children_eligible),0) AS e,
                   COALESCE(SUM(children_treated),0)  AS t
            FROM treatments{where}
            GROUP BY quarter_label
        """, params).fetchall()
    series = sorted(
        ({
            "quarter": r["q"],
            "eligible": int(r["e"]),
            "treated":  int(r["t"]),
            "percentage": _round_pct(int(r["t"]), int(r["e"])),
        } for r in rows if r["q"]),
        key=lambda p: _quarter_sort_key(p["quarter"]),
    )
    return series


# ---------------------------------------------------------------------------
# 1. Forecast (Holt's linear trend + bootstrap PI)
# ---------------------------------------------------------------------------
@router.get("/forecast")
def forecast(
    country: Optional[str] = None,
    state:   Optional[str] = None,
    horizon: int = Query(2, ge=1, le=4),
):
    """Returns historical series + N-step-ahead forecast with PI bands."""
    c = _norm(country)
    history = _historical_series(c, state=state)
    MIN_OBS = 4    # need ≥ 4 to grid-search alpha/beta meaningfully
    if len(history) < MIN_OBS:
        return {"history": history, "forecast": [], "method": "Holt linear",
                "note": f"Need at least {MIN_OBS} historical quarters for a forecast — "
                        f"currently have {len(history)}. Forecast disabled.",
                "min_history": MIN_OBS, "have_history": len(history)}

    values = [p["percentage"] for p in history]

    # ---- D2: grid-search alpha/beta on one-step-ahead MSE ---------------
    def _fit(alpha, beta, vals):
        level = float(vals[0])
        trend = float(vals[1] - vals[0])
        fitted = []
        for v in vals[1:]:
            fitted.append(level + trend)
            prev_level = level
            level = alpha * v + (1 - alpha) * (level + trend)
            trend = beta * (level - prev_level) + (1 - beta) * trend
        return fitted, level, trend

    best_mse = float("inf")
    best_alpha, best_beta = 0.5, 0.3
    grid = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]
    for a in grid:
        for b in grid:
            fitted_v, _, _ = _fit(a, b, values)
            mse = sum((act - pred) ** 2 for act, pred in zip(values[1:], fitted_v)) / max(1, len(fitted_v))
            if mse < best_mse:
                best_mse, best_alpha, best_beta = mse, a, b

    alpha, beta = best_alpha, best_beta
    fitted_next, level, trend = _fit(alpha, beta, values)

    # Residual SD on one-step-ahead errors (skip first since no prediction)
    actuals = values[1:]
    residuals = [a - f for a, f in zip(actuals, fitted_next)]
    if len(residuals) > 1:
        mean_r = sum(residuals) / len(residuals)
        var = sum((r - mean_r) ** 2 for r in residuals) / (len(residuals) - 1)
        sigma = math.sqrt(var)
    else:
        sigma = 5.0   # fallback conservative SD

    forecasts = []
    last_q = history[-1]["quarter"]
    for h in range(1, horizon + 1):
        point = level + h * trend
        # PI band widens with sqrt(h) under Holt's local-trend errors
        pi95 = 1.96 * sigma * math.sqrt(h)
        pi80 = 1.28 * sigma * math.sqrt(h)
        clamp = lambda x: round(max(0.0, min(105.0, x)), 1)
        forecasts.append({
            "quarter":    _next_quarter(last_q, h),
            "percentage": clamp(point),
            "ci80_lo":    clamp(point - pi80),
            "ci80_hi":    clamp(point + pi80),
            "ci95_lo":    clamp(point - pi95),
            "ci95_hi":    clamp(point + pi95),
            "is_forecast": True,
        })
    return {
        "history": history,
        "forecast": forecasts,
        "method": f"Holt linear (α={alpha}, β={beta} — grid-searched)",
        "sigma_residual": round(sigma, 2),
        "min_history": MIN_OBS,
        "have_history": len(history),
    }


# ---------------------------------------------------------------------------
# 2. Funnel — Eligible → Reached → Treated → Reported → Verified
# ---------------------------------------------------------------------------
@router.get("/funnel")
def funnel(country: Optional[str] = None, year: Optional[int] = None, round: Optional[int] = Query(None, alias="round")):
    """Stages: Eligible → Reached → Treated → Reported → Verified.

    Because the source dataset only records eligible + treated, the
    intermediate stages are illustrative. Reached ≈ treated × 1.05,
    Reported = treated (1:1 in this build), Verified = treated × 0.985
    (audit attrition). Replace with real funnel data when available."""
    c = _norm(country)
    clauses, params = [], []
    if c:    clauses.append("country = ?"); params.append(c)
    if year: clauses.append("year = ?"); params.append(year)
    if round is not None: clauses.append("rounds = ?"); params.append(round)
    where = (" WHERE " + " AND ".join(clauses)) if clauses else ""
    with get_conn(read_only=True) as conn:
        row = conn.execute(f"""
            SELECT COALESCE(SUM(children_eligible),0) AS e,
                   COALESCE(SUM(children_treated),0)  AS t
            FROM treatments{where}
        """, params).fetchone()
    eligible = int(row["e"] or 0)
    treated  = int(row["t"] or 0)
    reached  = min(eligible, int(round_n := treated / 0.95)) if treated else 0
    reported = treated
    verified = int(treated * 0.985)
    stages = [
        {"stage": "Eligible",  "value": eligible, "pct_of_eligible": 100},
        {"stage": "Reached",   "value": reached,  "pct_of_eligible": _round_pct(reached, eligible)},
        {"stage": "Treated",   "value": treated,  "pct_of_eligible": _round_pct(treated, eligible)},
        {"stage": "Reported",  "value": reported, "pct_of_eligible": _round_pct(reported, eligible)},
        {"stage": "Verified",  "value": verified, "pct_of_eligible": _round_pct(verified, eligible)},
    ]
    return {"stages": stages,
            "note": "Reached / Verified are model-based estimates pending real funnel ingestion."}


# ---------------------------------------------------------------------------
# 3. Cumulative coverage by round
# ---------------------------------------------------------------------------
@router.get("/cumulative")
def cumulative(country: Optional[str] = None):
    """Cumulative-coverage curve: per round, the running total of unique
    children treated divided by the eligible denominator. Because we have
    aggregate (not child-level) data, we estimate uniqueness via the
    upper-bound assumption that the same child is preferentially re-treated."""
    c = _norm(country)
    clauses, params = [], []
    if c: clauses.append("country = ?"); params.append(c)
    where = (" WHERE " + " AND ".join(clauses)) if clauses else ""
    with get_conn(read_only=True) as conn:
        rows = conn.execute(f"""
            SELECT rounds AS r,
                   COALESCE(SUM(children_eligible),0) AS e,
                   COALESCE(SUM(children_treated),0)  AS t
            FROM treatments{where}
            GROUP BY rounds
            ORDER BY rounds
        """, params).fetchall()
    # Eligible denominator: use the maximum eligible recorded across rounds
    # as the population reference (denominator stays fixed; treated accrues).
    elig_max = max((int(r["e"]) for r in rows), default=0)
    running_treated = 0
    series = []
    for r in rows:
        treated = int(r["t"])
        # Upper-bound on unique children reached after round n:
        running_treated = min(elig_max, max(running_treated, treated))
        series.append({
            "round": int(r["r"]),
            "treated_in_round": treated,
            "cumulative_treated": running_treated,
            "cumulative_pct": _round_pct(running_treated, elig_max),
        })
    return {"series": series, "eligible_population": elig_max}


# ---------------------------------------------------------------------------
# 4. Treatment-intensity heatmap (states × rounds)
# ---------------------------------------------------------------------------
@router.get("/intensity-heatmap")
def intensity_heatmap(country: str = Query(...)):
    c = _norm(country)
    if not c: raise HTTPException(400, "country is required")
    with get_conn(read_only=True) as conn:
        rows = conn.execute("""
            SELECT spatial_state AS s,
                   rounds AS r,
                   COALESCE(SUM(children_eligible),0) AS e,
                   COALESCE(SUM(children_treated),0)  AS t
            FROM treatments
            WHERE country = ?
            GROUP BY spatial_state, rounds
        """, (c,)).fetchall()
    states = sorted({r["s"] for r in rows if r["s"]})
    rounds = sorted({int(r["r"]) for r in rows if r["r"] is not None})
    grid = {(r["s"], int(r["r"])): _round_pct(int(r["t"]), int(r["e"])) for r in rows if r["s"] and r["r"] is not None}
    matrix = [
        {"state": s, "values": [grid.get((s, rd), None) for rd in rounds]}
        for s in states
    ]
    return {"rounds": rounds, "matrix": matrix}


# ---------------------------------------------------------------------------
# 5. Cohort retention (round-on-round)
# ---------------------------------------------------------------------------
@router.get("/retention")
def retention(country: Optional[str] = None):
    c = _norm(country)
    clauses, params = [], []
    if c: clauses.append("country = ?"); params.append(c)
    where = (" WHERE " + " AND ".join(clauses)) if clauses else ""
    with get_conn(read_only=True) as conn:
        rows = conn.execute(f"""
            SELECT rounds AS r,
                   COALESCE(SUM(children_treated),0) AS t,
                   COALESCE(SUM(children_eligible),0) AS e
            FROM treatments{where}
            GROUP BY rounds
            ORDER BY rounds
        """, params).fetchall()
    out, prev = [], None
    for r in rows:
        treated  = int(r["t"]); elig = int(r["e"])
        retention = None
        if prev is not None and prev > 0:
            retention = round((treated / prev) * 100, 1)
        out.append({
            "round": int(r["r"]),
            "treated": treated,
            "eligible": elig,
            "coverage": _round_pct(treated, elig),
            "retention_vs_prior_round": retention,
        })
        prev = treated
    return {"series": out}


# ---------------------------------------------------------------------------
# Per-state round-on-round retention (treated[n+1] vs treated[n])
# ---------------------------------------------------------------------------
@router.get("/retention-by-state")
def retention_by_state(country: str = Query(...)):
    c = _norm(country)
    if c is None: raise HTTPException(400, "country required")
    with get_conn(read_only=True) as conn:
        rows = conn.execute("""
            SELECT spatial_state AS s, rounds AS r,
                   COALESCE(SUM(children_treated),0) AS t
            FROM treatments
            WHERE country = ?
            GROUP BY spatial_state, rounds
            ORDER BY spatial_state, rounds
        """, (c,)).fetchall()
    # Group by state, compute round-on-round deltas
    by_state = {}
    for r in rows:
        if not r["s"]: continue
        by_state.setdefault(r["s"], []).append({"round": int(r["r"]), "treated": int(r["t"])})

    out = []
    for state, series in by_state.items():
        series.sort(key=lambda x: x["round"])
        # Aggregate per state: take the most recent round-pair (n-1 → n)
        if len(series) < 2:
            continue
        last = series[-1]; prev = series[-2]
        delta = last["treated"] - prev["treated"]
        retention = round((last["treated"] / prev["treated"]) * 100, 1) if prev["treated"] else None
        out.append({
            "state": state,
            "treated_prev": prev["treated"],
            "treated_now":  last["treated"],
            "delta": delta,                 # >0 = gained children, <0 = lost children
            "retention_pct": retention,
            "round_prev": prev["round"],
            "round_now":  last["round"],
        })
    out.sort(key=lambda x: (x["retention_pct"] or 0), reverse=True)
    return {"items": out}


# ---------------------------------------------------------------------------
# 6. Methodology metadata per indicator
# ---------------------------------------------------------------------------
METHODOLOGY = {
    "children_eligible": {
        "title": "Children Eligible",
        "definition": "Number of children aged 1–59 months in the target group for azithromycin distribution.",
        "formula": "Census-based estimate or microplan denominator.",
        "numerator": "—",
        "denominator": "Eligible population (1–59 months).",
        "exclusions": "Children with documented contraindications to azithromycin.",
        "source": "Sub-national microplanning; validated by NIMR / AVENIR-PNSO / CVD-Mali.",
        "frequency": "Per round (typically quarterly).",
        "assumptions": [
            "Denominator stays fixed for the duration of a round and is not adjusted for mid-round births, deaths, or migration.",
            "Children with temporary contraindications remain eligible; they are excluded only at the point of dosing.",
            "Microplan age verification (1–59 months) is not re-confirmed at the point of contact.",
        ],
        "references": ["WHO/AFRO MDA Reporting Guidelines, 2024",
                       "REACH Programme Operations Manual, v3"],
    },
    "children_treated": {
        "title": "Children Treated",
        "definition": "Number of eligible children who received the full dose of azithromycin during the round.",
        "formula": "Direct count of children treated.",
        "numerator": "Children who received the dose.",
        "denominator": "—",
        "exclusions": "Refusals, absentees, and contraindications.",
        "source": "Round summary forms reported by drug-distributors and validated by supervisors.",
        "frequency": "Per round.",
        "assumptions": [
            "Each child appears at most once per round (no double-counting between distributor teams).",
            "A 'full dose' means the standard weight-band dose was administered and witnessed by the distributor.",
            "Supervisor validation closes within ~7 days; figures may be revised after that window.",
        ],
        "references": ["WHO/AFRO MDA Reporting Guidelines, 2024"],
    },
    "percentage_treated": {
        "title": "Percentage Treated (Coverage)",
        "definition": "Programmatic coverage of the eligible population.",
        "formula": "Children Treated ÷ Children Eligible × 100.",
        "numerator": "Children Treated.",
        "denominator": "Children Eligible.",
        "exclusions": "Same as numerator and denominator above.",
        "source": "Sub-national microplanning + treatment registers.",
        "frequency": "Per round; aggregated quarterly.",
        "assumptions": [
            "Values above 100 % are possible when the microplan under-estimates the eligible population; they are flagged for verification rather than capped.",
            "Coverage is computed on the eligible denominator (not the full population); barriers to enrolment in microplanning are not reflected.",
            "Sub-national aggregates use each state's own numerator and denominator — no cross-state imputation.",
        ],
        "references": ["WHO NTD Roadmap 2021–2030 (target ≥ 80%)"],
    },
    "severe_adverse_event": {
        "title": "Severe Adverse Effects",
        "definition": "Number of severe adverse events reported during distribution rounds.",
        "formula": "Direct count from pharmacovigilance reports.",
        "numerator": "—",
        "denominator": "—  (for rate per 100k doses, divide by Children Treated × 100,000).",
        "exclusions": "Mild events (resolved without intervention).",
        "source": "Country pharmacovigilance system (CIOMS-compliant).",
        "frequency": "Continuous; aggregated per round.",
        "assumptions": [
            "All severe events that present at a health facility within 14 days of dosing are captured.",
            "Some under-reporting is expected — community-only events that do not reach a facility are not counted.",
            "Severity grading follows CIOMS V; reclassification on follow-up may revise counts retrospectively.",
        ],
        "references": ["WHO PIDM Reporting Guidance"],
    },
    "deaths_averted": {
        "title": "Estimated Deaths Averted",
        "definition": "Programmatic estimate of under-5 deaths averted through azithromycin distribution. Reported as a CENTRAL point estimate with a low–high band reflecting MORDOR trial uncertainty.",
        "formula": "Central = Children Treated ÷ 1,000.  Low = Children Treated × 0.5 ÷ 1,000.  High = Children Treated × 1.5 ÷ 1,000.",
        "numerator": "Children Treated.",
        "denominator": "1,000.",
        "exclusions": "Indirect (population-level) effects are not captured.",
        "source": "REACH programmatic assumption: 1 child death averted per 1,000 children treated with azithromycin, calibrated against the MORDOR trial mortality reduction.",
        "frequency": "Per round.",
        "assumptions": [
            "Central effect size: 1 averted death per 1,000 treated children. This corresponds to the MORDOR trial point estimate (RR 0.86; Keenan et al., NEJM 2018).",
            "Uncertainty band: low = 0.5/1,000 and high = 1.5/1,000 treated children. These bounds are derived from MORDOR's 95% confidence interval on the all-cause mortality risk ratio (0.79–0.93), translated proportionally onto the 1/1,000 central rate. Worked example: at 26,598,824 children treated, central = ~26,598; low ≈ 13,299; high ≈ 39,898.",
            "The range communicates uncertainty in the underlying clinical effect, not statistical sampling error in this dataset. It is NOT a population-level prediction interval.",
            "Fixed effect size assumption — the rate does not vary by country, by age within the 1–59 month band, or by baseline under-5 mortality. In settings with higher baseline mortality the true effect is likely greater; in lower-mortality settings it is likely smaller. The band conservatively brackets both.",
            "Counts only direct effects — indirect (population-level, herd) effects are excluded.",
            "Estimate is programmatic, not a model-based projection; intended for monitoring momentum, not for impact attribution.",
        ],
        "references": ["REACH Programme Operations Manual, v3",
                       "Keenan JD et al. NEJM 2018;378:1583-92 (MORDOR; effect-size basis and CI)"],
    },
}


METHODOLOGY_FR = {
    "children_eligible": {
        "title": "Enfants Éligibles",
        "definition": "Nombre total d'enfants âgés de 1 à 59 mois dans le groupe cible pour la distribution d'azithromycine.",
        "formula": "Estimation basée sur le recensement ou dénominateur du microplan.",
        "numerator": "—",
        "denominator": "Population éligible (1–59 mois).",
        "exclusions": "Enfants présentant des contre-indications documentées à l'azithromycine.",
        "source": "Microplanification sous-nationale ; validée par NIMR / AVENIR-PNSO / CVD-Mali.",
        "frequency": "Par tour (généralement trimestriel).",
        "assumptions": [
            "Le dénominateur reste fixe pendant la durée d'un tour ; il n'est pas ajusté pour les naissances, décès ou migrations en cours de tour.",
            "Les enfants ayant une contre-indication temporaire restent éligibles ; ils ne sont exclus qu'au moment du dosage.",
            "La tranche d'âge (1–59 mois) est appliquée via le microplan ; aucune re-vérification au point de contact n'est requise.",
        ],
        "references": ["Lignes directrices OMS/AFRO sur le rapport AMM, 2024",
                       "Manuel des opérations du programme REACH, v3"],
    },
    "children_treated": {
        "title": "Enfants Traités",
        "definition": "Nombre d'enfants éligibles ayant reçu la dose complète d'azithromycine pendant le tour.",
        "formula": "Comptage direct des enfants traités.",
        "numerator": "Enfants ayant reçu la dose.",
        "denominator": "—",
        "exclusions": "Refus, absents et contre-indications.",
        "source": "Formulaires de synthèse de tour rapportés par les distributeurs et validés par les superviseurs.",
        "frequency": "Par tour.",
        "assumptions": [
            "Chaque enfant est compté au plus une fois par tour (pas de double comptage entre équipes).",
            "Une « dose complète » correspond à la dose standard par tranche de poids, administrée et observée par le distributeur.",
            "La validation par le superviseur se clôt ~7 jours après le tour ; les chiffres peuvent être révisés au-delà.",
        ],
        "references": ["Lignes directrices OMS/AFRO sur le rapport AMM, 2024"],
    },
    "percentage_treated": {
        "title": "Pourcentage Traité (Couverture)",
        "definition": "Couverture programmatique de la population éligible.",
        "formula": "Enfants Traités ÷ Enfants Éligibles × 100.",
        "numerator": "Enfants Traités.",
        "denominator": "Enfants Éligibles.",
        "exclusions": "Identiques au numérateur et au dénominateur ci-dessus.",
        "source": "Microplanification sous-nationale + registres de traitement.",
        "frequency": "Par tour ; agrégé trimestriellement.",
        "assumptions": [
            "Les valeurs supérieures à 100 % sont possibles lorsque le microplan sous-estime la population éligible ; elles sont signalées pour vérification et non plafonnées.",
            "La couverture est calculée sur le dénominateur éligible (et non sur la population totale).",
            "Les agrégats infranationaux utilisent le numérateur et le dénominateur propres à chaque région — aucune imputation inter-régionale.",
        ],
        "references": ["Feuille de route OMS pour les MTN 2021–2030 (cible ≥ 80 %)"],
    },
    "severe_adverse_event": {
        "title": "Effets Indésirables Graves",
        "definition": "Nombre d'effets indésirables graves signalés pendant les tours de distribution.",
        "formula": "Comptage direct issu des rapports de pharmacovigilance.",
        "numerator": "—",
        "denominator": "— (pour un taux pour 100 000 doses, diviser par Enfants Traités × 100 000).",
        "exclusions": "Événements légers (résolus sans intervention).",
        "source": "Système national de pharmacovigilance (conforme CIOMS).",
        "frequency": "Continu ; agrégé par tour.",
        "assumptions": [
            "Tous les événements graves se présentant à un établissement de santé dans les 14 jours suivant le dosage sont saisis.",
            "Une sous-déclaration est attendue — les événements communautaires qui n'atteignent pas un établissement ne sont pas comptés.",
            "La cotation de sévérité suit CIOMS V ; les comptes peuvent être révisés en cas de reclassement au suivi.",
        ],
        "references": ["Orientation OMS PIDM sur les rapports"],
    },
    "deaths_averted": {
        "title": "Décès Évités Estimés",
        "definition": "Estimation programmatique des décès d'enfants de moins de 5 ans évités grâce à la distribution d'azithromycine. Présenté sous forme d'une estimation centrale assortie d'une fourchette basse–haute reflétant l'incertitude de l'essai MORDOR.",
        "formula": "Central = Enfants Traités ÷ 1 000.  Bas = Enfants Traités × 0,5 ÷ 1 000.  Haut = Enfants Traités × 1,5 ÷ 1 000.",
        "numerator": "Enfants Traités.",
        "denominator": "1 000.",
        "exclusions": "Effets indirects au niveau populationnel non pris en compte.",
        "source": "Hypothèse programmatique REACH : 1 décès évité pour 1 000 enfants traités à l'azithromycine, calibrée sur la réduction de mortalité observée dans l'essai MORDOR.",
        "frequency": "Par tour.",
        "assumptions": [
            "Effet central : 1 décès évité pour 1 000 enfants traités. Correspond à l'estimation centrale de l'essai MORDOR (RR 0,86 ; Keenan et al., NEJM 2018).",
            "Fourchette d'incertitude : bas = 0,5/1 000 et haut = 1,5/1 000 enfants traités. Ces bornes sont dérivées de l'intervalle de confiance à 95 % de MORDOR sur le risque relatif de mortalité toutes causes (0,79–0,93), transposé proportionnellement sur le taux central de 1/1 000. Exemple : pour 26 598 824 enfants traités, central ≈ 26 598 ; bas ≈ 13 299 ; haut ≈ 39 898.",
            "La fourchette communique l'incertitude sur l'effet clinique sous-jacent, et non l'erreur d'échantillonnage statistique de ce jeu de données. Il ne s'agit PAS d'un intervalle de prédiction au niveau populationnel.",
            "Effet fixe — le taux ne varie ni selon le pays, ni selon l'âge dans 1–59 mois, ni selon la mortalité de base. Dans les contextes à mortalité de base élevée, l'effet réel est probablement supérieur ; dans les contextes à mortalité plus faible, probablement inférieur. La fourchette encadre les deux cas avec prudence.",
            "Ne compte que les effets directs — les effets indirects (au niveau populationnel) sont exclus.",
            "Estimation programmatique et non modèle prédictif — destinée au suivi opérationnel, pas à l'attribution d'impact.",
        ],
        "references": ["Manuel des opérations du programme REACH, v3",
                       "Keenan JD et al. NEJM 2018;378:1583-92 (MORDOR ; base et IC de l'effet)"],
    },
}


@router.get("/methodology/{indicator}")
def methodology(indicator: str, lang: str = "en"):
    key = indicator.lower().strip()
    table = METHODOLOGY_FR if (lang or "").lower().startswith("fr") else METHODOLOGY
    m = table.get(key) or METHODOLOGY.get(key)
    if not m:
        raise HTTPException(404, f"No methodology entry for indicator: {indicator}")
    return m


@router.get("/methodology")
def methodology_all(lang: str = "en"):
    """Returns every indicator's full methodology — used by the
    'Download all methodology' PDF button on the front-end."""
    table = METHODOLOGY_FR if (lang or "").lower().startswith("fr") else METHODOLOGY
    # Preserve the natural KPI order shown in the dashboard.
    order = ["children_eligible", "children_treated", "percentage_treated",
             "severe_adverse_event", "deaths_averted"]
    items = []
    for k in order:
        entry = table.get(k) or METHODOLOGY.get(k)
        if entry:
            items.append({"indicator": k, **entry})
    return {"items": items, "language": "fr" if (lang or "").lower().startswith("fr") else "en"}


# ---------------------------------------------------------------------------
# 7. Source-of-truth metadata per country
# ---------------------------------------------------------------------------
SOURCE_META = {
    "REGIONAL": {
        "source":          "Aggregated from Nigerian Institute of Medical Research, AVENIR/PNSO, and CVD-Mali.",
        "extraction_date": "2026-06-01",
        "last_validated":  "2026-05-28",
        "version":         "v2.1",
        "coverage_period": "2024 Q1 — 2025 Q4",
        "license":         "Reuse permitted with citation (CC-BY 4.0).",
    },
    "NIGERIA": {
        "source":          "Nigerian Institute of Medical Research (NIMR).",
        "extraction_date": "2026-06-01",
        "last_validated":  "2026-05-28",
        "version":         "v2.1",
        "coverage_period": "2024 Q1 — 2025 Q4",
        "license":         "Reuse permitted with citation (CC-BY 4.0).",
    },
    "NIGER": {
        "source":          "AVENIR consortium / PNSO (Programme National de Santé Oculaire).",
        "extraction_date": "2026-06-01",
        "last_validated":  "2026-05-25",
        "version":         "v1.8",
        "coverage_period": "2024 Q4 — 2025 Q4",
        "license":         "Reuse permitted with citation (CC-BY 4.0).",
    },
    "MALI": {
        "source":          "Centre de Vaccinologie pour le Développement, Mali (CVD-Mali).",
        "extraction_date": "2026-06-01",
        "last_validated":  "2026-05-30",
        "version":         "v1.4",
        "coverage_period": "2025 Q3 — 2025 Q4",
        "license":         "Reuse permitted with citation (CC-BY 4.0).",
    },
}


@router.get("/source-metadata")
def source_metadata(country: Optional[str] = None):
    key = (_norm(country) or "REGIONAL")
    return SOURCE_META.get(key, SOURCE_META["REGIONAL"])
