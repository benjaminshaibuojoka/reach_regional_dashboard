import React, { useEffect, useState } from "react";
import { apiFetch, apiRoot as root } from "../http.js";
const fmt = (n) => Number(n || 0).toLocaleString();

export default function Funnel({ country }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    const u = new URLSearchParams();
    if (country) u.set("country", country);
    apiFetch(`${root}/funnel${u.toString() ? "?" + u : ""}`)
      .then(r => r.json()).then(setData).catch(() => setData(null));
  }, [country]);

  if (!data?.stages?.length) return null;
  const max = data.stages[0].value || 1;

  return (
    <div className="funnel">
      {data.stages.map((s, i) => {
        const w = (s.value / max) * 100;
        const drop = i > 0 ? data.stages[i - 1].value - s.value : 0;
        const dropPct = i > 0 && data.stages[i - 1].value
          ? ((drop / data.stages[i - 1].value) * 100).toFixed(1)
          : null;
        return (
          <div key={s.stage} className="funnel-row">
            <div className="funnel-row__label">{s.stage}</div>
            <div className="funnel-row__bar-wrap">
              <div className="funnel-row__bar" style={{ width: `${w}%` }}>
                <span className="funnel-row__count">{fmt(s.value)}</span>
                <span className="funnel-row__pct">{s.pct_of_eligible}%</span>
              </div>
              {dropPct && Number(dropPct) > 0 && (
                <div className="funnel-row__drop">▼ {dropPct}%</div>
              )}
            </div>
          </div>
        );
      })}
      <div className="funnel__note">{data.note}</div>
    </div>
  );
}
