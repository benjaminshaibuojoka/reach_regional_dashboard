import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FlagNG, FlagNE, FlagML } from "./Flags.jsx";
import { apiFetch, apiRoot, qs } from "../http.js";
import Sparkline from "./Sparkline.jsx";

/**
 * Country momentum cards — plain-language summary tiles.
 *
 * Each card answers, in everyday words:
 *   - Which country and when?            (flag · name · quarter)
 *   - How many children were reached?    ("91% of children reached")
 *   - Better or worse than last time?    ("Up 11 from 2025 Q4")
 *   - The actual numbers?                ("26.6M of 29.2M children reached")
 *
 * The wording deliberately avoids "pts", "coverage", "WHO target" and any
 * symbol whose meaning isn't obvious to a non-technical reader.
 */

const COUNTRIES = [
  { key: "NIGERIA", to: "/nigeria", flag: FlagNG, labelKey: "nigeria" },
  { key: "NIGER",   to: "/niger",   flag: FlagNE, labelKey: "niger" },
  { key: "MALI",    to: "/mali",    flag: FlagML, labelKey: "mali" },
];

const TARGET_PCT = 80;

const compact = (n) => {
  const v = Number(n || 0);
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}K`;
  return v.toLocaleString();
};

export default function CountryHighlights({ layout = "vertical" }) {
  const { t } = useTranslation();
  const [data, setData] = useState({});

  useEffect(() => {
    let cancelled = false;
    Promise.all(COUNTRIES.map(async ({ key }) => {
      const [spark, kpis] = await Promise.all([
        apiFetch(`${apiRoot}/sparkline${qs({ country: key, last_n: 6 })}`)
          .then(r => r.ok ? r.json() : [])
          .catch(() => []),
        apiFetch(`${apiRoot}/kpis${qs({ country: key })}`)
          .then(r => r.ok ? r.json() : null)
          .catch(() => null),
      ]);
      return [key, { spark, kpis }];
    })).then(pairs => {
      if (cancelled) return;
      setData(Object.fromEntries(pairs));
    });
    return () => { cancelled = true; };
  }, []);

  const vertical = layout === "vertical";

  // Plain-language phrasing for the change vs previous quarter.
  // Shows BOTH percentages explicitly so "11" never sits alone with no
  // unit — instead the reader sees "Up from 80% in 2024 Q1". The current
  // quarter's % is already shown big above the line, so the eye traces
  // a clear before → after path without doing any mental math.
  const phraseDelta = (dir, prevPct, prevQtr) => {
    if (prevPct == null || prevQtr == null)
      return t("home_momentum_no_prev", { defaultValue: "No earlier quarter to compare" });
    if (dir === "up")
      return t("home_momentum_up", { prevPct, prev: prevQtr,
        defaultValue: "Up from {{prevPct}}% in {{prev}}" });
    if (dir === "down")
      return t("home_momentum_down", { prevPct, prev: prevQtr,
        defaultValue: "Down from {{prevPct}}% in {{prev}}" });
    return t("home_momentum_flat", { prevPct, prev: prevQtr,
      defaultValue: "Same as {{prev}} ({{prevPct}}%)" });
  };

  return (
    <section className={`momentum momentum--${vertical ? "vertical" : "row"}`}
             aria-labelledby="momentum-title">
      <header className="momentum__head">
        <h2 id="momentum-title" className="momentum__title">
          {t("home_momentum_title", { defaultValue: "Progress by country" })}
        </h2>
        <p className="momentum__sub">
          {t("home_momentum_sub", {
            defaultValue: "Share of eligible children reached for treatment. Global target: 80%.",
          })}
        </p>
      </header>

      <ul className={`momentum__list momentum__list--${vertical ? "vertical" : "row"}`}>
        {COUNTRIES.map(({ key, to, flag: Flag, labelKey }) => {
          const { spark = [], kpis = null } = data[key] || {};
          const cur  = spark[spark.length - 1];
          const prev = spark[spark.length - 2];
          const values = spark.map(p => p.percentage);

          const dPts = (cur && prev)
            ? Math.round((cur.percentage - prev.percentage) * 10) / 10
            : null;
          const dir = dPts == null ? "flat" : dPts > 0 ? "up" : dPts < 0 ? "down" : "flat";
          const arrow = dir === "up" ? "▲" : dir === "down" ? "▼" : "■";
          const sparkColor = dir === "up" ? "#15803d"
                          : dir === "down" ? "#b14a2a"
                          : "#8a7615";

          const pct      = kpis?.percentage_treated ?? cur?.percentage ?? null;
          const treated  = kpis?.children_treated   ?? cur?.treated   ?? null;
          const eligible = kpis?.children_eligible  ?? cur?.eligible  ?? null;

          const barPct = pct == null ? 0 : Math.min(pct, 100);

          return (
            <li key={key} className="momentum__item">
              <Link to={to}
                    className={`momentum__card momentum__card--${dir}`}
                    aria-label={`${t(labelKey)} — ${pct ?? "—"} percent of children reached`}>
                {/* Row 1: Flag · Country · Latest-quarter pill */}
                <div className="momentum__top">
                  <span className="momentum__flag"><Flag size={16} /></span>
                  <span className="momentum__country">{t(labelKey)}</span>
                  {cur?.quarter && <span className="momentum__qtr">{cur.quarter}</span>}
                </div>

                {/* Row 2: Big % + plain-language delta (shows previous %
                    explicitly so the change is never ambiguous). */}
                <div className="momentum__cov-head">
                  <span className="momentum__pct">{pct ?? "—"}<small>%</small></span>
                  <span className={`momentum__delta momentum__delta--${dir}`}>
                    {arrow} {phraseDelta(dir, prev?.percentage, prev?.quarter)}
                  </span>
                </div>

                {/* Row 3: Bar with target tick + trailing sparkline. The tick
                    has a clear hover-tooltip so the user knows what the mark
                    means without needing to know "WHO". */}
                <div className="momentum__bar-wrap">
                  <div className="momentum__bar" role="progressbar"
                       aria-valuenow={Math.round(pct ?? 0)} aria-valuemin={0} aria-valuemax={100}
                       title={t("home_momentum_bar_tip", {
                         defaultValue: "The bar shows how many children have been reached. The dark mark is the 80% global target.",
                       })}>
                    <div className="momentum__bar-fill" style={{ width: `${barPct}%` }} />
                    <div className="momentum__bar-target" style={{ left: `${TARGET_PCT}%` }} />
                  </div>
                  <Sparkline values={values} width={52} height={14} amplitude={0.7} color={sparkColor} />
                </div>

                {/* Row 4: Plain English — "26.6M of 29.2M children reached" */}
                <div className="momentum__stats-line">
                  <b>{treated != null ? compact(treated) : "—"}</b>
                  <span className="momentum__stats-label">
                    {" "}{t("home_momentum_of", { defaultValue: "of" })}{" "}
                    <b>{eligible != null ? compact(eligible) : "—"}</b>{" "}
                    {t("home_momentum_children_reached", { defaultValue: "children reached" })}
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
