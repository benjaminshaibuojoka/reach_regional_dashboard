import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FlagNG, FlagNE, FlagML } from "./Flags.jsx";
import { apiFetch, apiRoot, qs } from "../http.js";
import Sparkline from "./Sparkline.jsx";

/**
 * Country momentum cards — compact, single-purpose tiles, each answering:
 *   - Where is coverage now?      (big % + bar with WHO-80 % tick)
 *   - Has it moved this quarter?  (▲/▼/■ delta vs previous quarter)
 *   - What's the underlying volume? (children treated + eligible, inline)
 *
 * Three cards stack vertically beside the navigation; tuned so all three
 * fit at a glance without scrolling on standard desktop heights.
 */

const COUNTRIES = [
  { key: "NIGERIA", to: "/nigeria", flag: FlagNG, labelKey: "nigeria" },
  { key: "NIGER",   to: "/niger",   flag: FlagNE, labelKey: "niger" },
  { key: "MALI",    to: "/mali",    flag: FlagML, labelKey: "mali" },
];

const TARGET_PCT = 80;     // WHO NTD roadmap target

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

  return (
    <section className={`momentum momentum--${vertical ? "vertical" : "row"}`}
             aria-labelledby="momentum-title">
      <header className="momentum__head">
        <h2 id="momentum-title" className="momentum__title">
          {t("home_momentum_title", { defaultValue: "Country momentum" })}
        </h2>
        <p className="momentum__sub">
          {t("home_momentum_sub", {
            defaultValue: "Latest-quarter coverage vs the WHO 80% target",
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
                    aria-label={`${t(labelKey)} — coverage ${pct ?? "—"}%`}>
                {/* Row 1: Flag · Name · Quarter pill */}
                <div className="momentum__top">
                  <span className="momentum__flag"><Flag size={16} /></span>
                  <span className="momentum__country">{t(labelKey)}</span>
                  {cur?.quarter && <span className="momentum__qtr">{cur.quarter}</span>}
                </div>

                {/* Row 2: Big % · Delta */}
                <div className="momentum__cov-head">
                  <span className="momentum__pct">{pct ?? "—"}<small>%</small></span>
                  <span className={`momentum__delta momentum__delta--${dir}`}>
                    {arrow}{" "}
                    {dPts == null
                      ? "—"
                      : `${dPts > 0 ? "+" : dPts < 0 ? "−" : ""}${Math.abs(dPts)} pts`}
                  </span>
                </div>

                {/* Row 3: Bar with WHO-80% tick · trailing sparkline */}
                <div className="momentum__bar-wrap">
                  <div className="momentum__bar" role="progressbar"
                       aria-valuenow={Math.round(pct ?? 0)} aria-valuemin={0} aria-valuemax={100}>
                    <div className="momentum__bar-fill" style={{ width: `${barPct}%` }} />
                    <div className="momentum__bar-target" style={{ left: `${TARGET_PCT}%` }}
                         title={`WHO target ${TARGET_PCT}%`} />
                  </div>
                  <Sparkline values={values} width={52} height={14} amplitude={0.7} color={sparkColor} />
                </div>

                {/* Row 4: one-line stats — short labels, never wraps.
                    "WHO 80%" is already encoded by the tick on the bar
                    above, so we don't repeat it as text. */}
                <div className="momentum__stats-line"
                     title={`${treated != null ? compact(treated) : "—"} treated of ${eligible != null ? compact(eligible) : "—"} eligible`}>
                  <b>{treated != null ? compact(treated) : "—"}</b>
                  <span className="momentum__stats-sep">/</span>
                  <b>{eligible != null ? compact(eligible) : "—"}</b>
                  <span className="momentum__stats-label">
                    {t("home_momentum_stats_label", { defaultValue: "children treated of eligible" })}
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
