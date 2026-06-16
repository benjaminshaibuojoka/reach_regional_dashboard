# Methodology

This file mirrors what's served by `/api/methodology` (and rendered in the Methods drawer + the "All methodology (PDF)" download). It is the canonical written description of each KPI used on the dashboard.

> Reminder: every indicator is computed on the eligible denominator from the microplan, not from full census population. See *Assumptions* under each KPI.

---

## Children Eligible

* **Definition** — Number of children aged 1–59 months in the target group for azithromycin distribution.
* **Formula** — Census-based estimate or microplan denominator.
* **Numerator** — n/a
* **Denominator** — Eligible population (1–59 months).
* **Exclusions** — Children with documented contraindications to azithromycin.
* **Source** — Sub-national microplanning; validated by NIMR / AVENIR-PNSO / CVD-Mali.
* **Frequency** — Per round (typically quarterly).
* **Assumptions**
  - Denominator stays fixed for the duration of a round and is not adjusted for mid-round births, deaths, or migration.
  - Children with temporary contraindications remain eligible; they are excluded only at the point of dosing.
  - Microplan age verification (1–59 months) is not re-confirmed at the point of contact.

## Children Treated

* **Definition** — Number of eligible children who received the full dose of azithromycin during the round.
* **Formula** — Direct count of children treated.
* **Numerator** — Children who received the dose.
* **Source** — Round summary forms reported by drug-distributors and validated by supervisors.
* **Frequency** — Per round.
* **Assumptions**
  - Each child appears at most once per round (no double-counting between distributor teams).
  - A "full dose" means the standard weight-band dose was administered and witnessed by the distributor.
  - Supervisor validation closes within ~7 days; figures may be revised after that window.

## Percentage Treated (Coverage)

* **Definition** — Programmatic coverage of the eligible population.
* **Formula** — `Children Treated ÷ Children Eligible × 100`.
* **Source** — Sub-national microplanning + treatment registers.
* **Frequency** — Per round; aggregated quarterly.
* **Assumptions**
  - Values above 100% are possible when the microplan under-estimates the eligible population; they are flagged for verification rather than capped.
  - Coverage is computed on the eligible denominator (not the full population); barriers to enrolment in microplanning are not reflected.
  - Sub-national aggregates use each state's own numerator and denominator — no cross-state imputation.
* **References** — WHO NTD Roadmap 2021–2030 (target ≥ 80%).

## Severe Adverse Effects

* **Definition** — Number of severe adverse events reported during distribution rounds.
* **Formula** — Direct count from pharmacovigilance reports.
* **Denominator** — For rate per 100,000 doses, divide by Children Treated × 100,000.
* **Exclusions** — Mild events (resolved without intervention).
* **Source** — Country pharmacovigilance system (CIOMS-compliant).
* **Frequency** — Continuous; aggregated per round.
* **Assumptions**
  - All severe events that present at a health facility within 14 days of dosing are captured.
  - Some under-reporting is expected — community-only events that do not reach a facility are not counted.
  - Severity grading follows CIOMS V; reclassification on follow-up may revise counts retrospectively.
* **References** — WHO PIDM Reporting Guidance.

## Estimated Deaths Averted

* **Definition** — Programmatic estimate of under-5 deaths averted through azithromycin distribution. Reported as a CENTRAL point estimate with a low–high band reflecting MORDOR trial uncertainty.
* **Formula**
  - Central = `Children Treated ÷ 1,000`
  - Low = `Children Treated × 0.5 ÷ 1,000`
  - High = `Children Treated × 1.5 ÷ 1,000`
* **Source** — REACH programmatic assumption: 1 child death averted per 1,000 children treated, calibrated against the MORDOR trial mortality reduction.
* **Frequency** — Per round.
* **Assumptions**
  - Central effect size: 1 averted death per 1,000 treated children. Corresponds to the MORDOR point estimate (RR 0.86; Keenan et al., NEJM 2018).
  - **Uncertainty band**: low = 0.5/1,000 and high = 1.5/1,000 treated children, derived from MORDOR's 95% confidence interval on the all-cause mortality risk ratio (0.79–0.93), translated proportionally onto the 1/1,000 central rate. *Worked example*: at ~26.6M children treated, central ≈ 26,598; low ≈ 13,299; high ≈ 39,898.
  - The range communicates **uncertainty in the underlying clinical effect**, not statistical sampling error in this dataset. It is NOT a population-level prediction interval.
  - Fixed effect size assumption — the rate does not vary by country, by age within the 1–59 month band, or by baseline under-5 mortality. In settings with higher baseline mortality the true effect is likely greater; in lower-mortality settings it is likely smaller. The band conservatively brackets both.
  - Counts only direct effects — indirect (population-level / herd) effects are excluded.
  - Estimate is programmatic, not a model-based projection; intended for monitoring momentum, not for impact attribution.
* **References**
  - REACH Programme Operations Manual, v3.
  - Keenan JD et al. NEJM 2018;378:1583-92 (MORDOR; effect-size basis and CI).

---

## Statistical methods used elsewhere

### Forecast (Trend → Forecast toggle)

* **Method** — Holt's linear-trend exponential smoothing.
* **Parameters** — α and β are **grid-searched** over `{0.1, 0.2, …, 0.9}` on one-step-ahead MSE; the best pair is reported in the response as `method`.
* **Prediction intervals** — built from the residual SD of in-sample one-step errors; widen with √h: PI80 = 1.28σ√h, PI95 = 1.96σ√h.
* **Guard** — disabled when fewer than 4 historical quarters are available.

### Funnel

Eligible → Reached → Treated → Reported → Verified.

The source data has Eligible + Treated; intermediate stages are placeholders pending real funnel ingestion: Reached ≈ Treated × 1.05, Reported = Treated, Verified = Treated × 0.985.

### Cumulative coverage

Per round, the running total of unique children treated divided by the maximum eligible denominator across rounds (upper-bound assumption that the same child is preferentially re-treated).

### Round-on-round retention

`retention_vs_prior_round = treated_n / treated_{n−1} × 100`. Values < 100 = lost children; > 100 = gained.

### Per-state retention bars

Per state, taking the last two recorded rounds: `delta = treated_last − treated_prev`, `retention_pct = treated_last / treated_prev × 100`.
