import React, { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine, Cell,
} from "recharts";

import { apiFetch, apiRoot as root } from "../http.js";

export default function RetentionChart({ country }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    const u = new URLSearchParams();
    if (country) u.set("country", country);
    apiFetch(`${root}/retention${u.toString() ? "?" + u : ""}`)
      .then(r => r.json()).then(setData).catch(() => setData(null));
  }, [country]);

  if (!data?.series?.length) return null;
  const rows = data.series
    .filter(s => s.retention_vs_prior_round != null)
    .map(s => ({
      label: `R${s.round - 1} → R${s.round}`,
      retention: s.retention_vs_prior_round,
      delta: s.retention_vs_prior_round - 100,
    }));
  if (!rows.length) return <div style={{padding:8, color:"#66625e", fontSize:11}}>Need ≥ 2 rounds to compute retention.</div>;

  const colorFor = (v) => v >= 100 ? "#b89e1d" : v >= 90 ? "#f0d860" : "#d97706";

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} margin={{ top: 18, right: 24, bottom: 4, left: 24 }}>
        <CartesianGrid stroke="#f3f0ea" vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "#e3ddd3" }} tick={{ fontSize: 11, fill: "#66625e" }} />
        <YAxis tick={{ fontSize: 10, fill: "#66625e" }} axisLine={false} tickLine={false}
               label={{ value: "Retention %", angle: -90, position: "insideLeft", offset: 10, fontSize: 9, fill: "#66625e" }} />
        <Tooltip
          contentStyle={{ borderRadius: 6, border: "1px solid #e3ddd3", fontSize: 11 }}
          formatter={(v) => [`${v}%`, "Round-on-round retention"]}
        />
        <ReferenceLine y={100} stroke="#8a7615" strokeDasharray="3 3"
                       label={{ value: "Parity (100%)", position: "right", fontSize: 9, fill: "#8a7615" }} />
        <Bar dataKey="retention" radius={[4, 4, 0, 0]}>
          {rows.map((r, i) => (<Cell key={i} fill={colorFor(r.retention)} />))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
