import React, { useEffect, useState } from "react";
import {
  ComposedChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine, ReferenceArea, LabelList,
} from "recharts";

import { apiFetch, apiRoot as root, qs } from "../http.js";
// Canonicalise quarter labels — backend has historically returned both
// "2025 Q3" and "Q3 2025" forms. We display "Q3 2025" everywhere.
const canonQuarter = (q) => {
  if (!q) return q;
  const m = String(q).match(/^(\d{4})\s*Q(\d)$/);
  if (m) return `Q${m[2]} ${m[1]}`;
  return q;
};

const MIN_HISTORY_FOR_FORECAST = 4;

export default function TrendLine({ data = [], country, mode = "trend" }) {
  const [forecast, setForecast] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (mode !== "forecast") return;
    setBusy(true);
    apiFetch(`${root}/forecast${qs({ country, horizon: 2 })}`)
      .then(r => r.json()).then(setForecast)
      .catch(() => setForecast(null))
      .finally(() => setBusy(false));
  }, [mode, country]);

  let merged = data.map(p => ({ ...p, quarter: canonQuarter(p.quarter) }));
  let firstForecast = null;
  let belowMinHistory = false;

  if (mode === "forecast" && forecast?.history) {
    if (forecast.history.length < MIN_HISTORY_FOR_FORECAST) {
      belowMinHistory = true;
    } else {
      merged = [
        ...forecast.history.map(p => ({ ...p, quarter: canonQuarter(p.quarter), kind: "actual" })),
        ...(forecast.forecast || []).map(p => ({ ...p, quarter: canonQuarter(p.quarter), kind: "forecast" })),
      ];
      firstForecast = canonQuarter(forecast.forecast?.[0]?.quarter);
    }
  }

  return (
    <div className="trend-wrap">
      {busy && (
        <div className="trend-skel" aria-hidden="true">
          <div className="trend-skel__line" />
          <div className="trend-skel__line trend-skel__line--2" />
          <div className="trend-skel__line trend-skel__line--3" />
        </div>
      )}
      {belowMinHistory && !busy && (
        <div className="trend-notice">
          Forecast needs ≥ {MIN_HISTORY_FOR_FORECAST} historical quarters.
          Switch back to <b>Trend</b> for now.
        </div>
      )}
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={merged} margin={{ top: 26, right: 28, bottom: 4, left: 28 }}>
          <defs>
            <linearGradient id="goldFade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#e3c934" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#e3c934" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#f3f0ea" vertical={false} />
          <XAxis dataKey="quarter" tickLine={false} axisLine={{ stroke: "#e3ddd3" }}
                 tick={{ fontSize: 11, fill: "#66625e" }} padding={{ left: 14, right: 14 }} />
          {/* Y axis hidden to give the chart more vertical room. */}
          <YAxis hide domain={[0, 110]} />
          <Tooltip contentStyle={{ borderRadius: 6, border: "1px solid #e3ddd3", fontSize: 11 }}
                   formatter={(v) => [`${v}%`, ""]}
                   labelStyle={{ color: "#45423f", fontWeight: 700 }} />
          {mode === "forecast" && firstForecast && (
            <>
              <ReferenceArea x1={firstForecast} fill="#fbf3cc" fillOpacity={0.7} />
              <Area dataKey="ci95_hi" stroke={false} fill="#ecd966" fillOpacity={0.22} />
              <Area dataKey="ci95_lo" stroke={false} fill="#ffffff" fillOpacity={1} />
              <Area dataKey="ci80_hi" stroke={false} fill="#e3c934" fillOpacity={0.28} />
              <Area dataKey="ci80_lo" stroke={false} fill="#ffffff" fillOpacity={1} />
            </>
          )}
          <ReferenceLine y={80} stroke="#c1a82c" strokeDasharray="3 3" strokeWidth={1} />
          <Area type="monotone" dataKey="percentage" stroke="#c1a82c" strokeWidth={2.4}
                fill="url(#goldFade)"
                dot={(props) => {
                  const isFc = props?.payload?.is_forecast;
                  return (<circle cx={props.cx} cy={props.cy} r={4}
                                  fill={isFc ? "#fff" : "#c1a82c"}
                                  stroke={isFc ? "#c1a82c" : "#fff"} strokeWidth={2} />);
                }}>
            <LabelList dataKey="percentage" position="top"
              content={({ x, y, value, index }) => {
                if (value == null) return null;
                // In forecast mode there are 6+ points stacked into the same
                // chart width — labels clobber each other. Strategy: show
                // labels only for the FIRST historical point, the LAST
                // historical point, and the forecast points.
                if (mode === "forecast") {
                  const total = merged.length;
                  const firstActual = 0;
                  const lastActual  = (forecast?.history?.length || 1) - 1;
                  const isForecast  = merged[index]?.is_forecast;
                  if (!(index === firstActual || index === lastActual || isForecast)) return null;
                }
                return <text x={x} y={y - 8} textAnchor="middle" fontSize="10"
                             fontWeight="700" fill="#45423f">{value}%</text>;
              }} />
          </Area>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
