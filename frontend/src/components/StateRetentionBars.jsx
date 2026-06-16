import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch, apiRoot as root } from "../http.js";
const fmt = (n) => Number(n || 0).toLocaleString();
const fmtSigned = (n) => (n >= 0 ? `+${fmt(n)}` : `−${fmt(Math.abs(n))}`);

export default function StateRetentionBars({ country }) {
  const { t } = useTranslation();
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!country) return;
    apiFetch(`${root}/retention-by-state?country=${country}`)
      .then(r => r.json()).then(setData).catch(() => setData(null));
  }, [country]);

  if (!data?.items?.length) {
    return <div style={{padding:8, color:"#66625e", fontSize:11}}>
      {t("growth_no_data")}
    </div>;
  }

  // Sort: largest gains at top, biggest losses at bottom
  const items = [...data.items].sort(
    (a, b) => (b.retention_pct ?? 0) - (a.retention_pct ?? 0)
  );
  const maxAbsDelta = Math.max(1, ...items.map(i => Math.abs(i.delta || 0)));

  return (
    <div className="growth">
      <div className="growth__head">
        <span>{t("growth_col_region")}</span>
        <span>{t("growth_col_pct")}</span>
        <span></span>
        <span className="growth__right">{t("growth_col_delta")}</span>
      </div>

      {items.map(it => {
        const growthPct = (it.retention_pct ?? 100) - 100;     // shift baseline to 0
        const up = growthPct >= 0;
        const bw = (Math.abs(it.delta || 0) / maxAbsDelta) * 100;
        // Guarantee a minimum visible bar even for tiny deltas
        const barWidth = Math.max(3, bw);
        return (
          <div className="growth__row" key={it.state}
               title={`${it.state}: round ${it.round_prev} → ${it.round_now} · ${fmt(it.treated_prev)} → ${fmt(it.treated_now)}`}>
            <div className="growth__name">{it.state}</div>
            <div className={`growth__pct growth__pct--${up ? "up" : "down"}`}>
              {up ? "↑" : "↓"} {Math.abs(growthPct).toFixed(1)}%
            </div>
            <div className="growth__bar-cell">
              <div className={`growth__bar growth__bar--${up ? "gain" : "loss"}`}
                   style={{ width: `${barWidth}%` }} />
            </div>
            <div className={`growth__delta growth__delta--${up ? "up" : "down"}`}>
              {fmtSigned(it.delta || 0)}
            </div>
          </div>
        );
      })}

      <div className="growth__note">{t("growth_note")}</div>
    </div>
  );
}
