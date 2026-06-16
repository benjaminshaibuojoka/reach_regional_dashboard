import React, { useEffect, useState } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine,
} from "recharts";

import { apiFetch, apiRoot as root } from "../http.js";
const fmt = (n) => Number(n || 0).toLocaleString();

export default function CumulativeCoverage({ country }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    const u = new URLSearchParams();
    if (country) u.set("country", country);
    apiFetch(`${root}/cumulative${u.toString() ? "?" + u : ""}`)
      .then(r => r.json()).then(setData).catch(() => setData(null));
  }, [country]);

  if (!data?.series?.length) return null;
  const merged = data.series.map(p => ({
    round: `Round ${p.round}`,
    treated_in_round: p.treated_in_round,
    cumulative_pct: p.cumulative_pct,
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={merged} margin={{ top: 14, right: 36, bottom: 4, left: 36 }}>
        <CartesianGrid stroke="#f3f0ea" vertical={false} />
        <XAxis dataKey="round" tickLine={false} axisLine={{ stroke: "#e3ddd3" }} tick={{ fontSize: 11, fill: "#66625e" }} />
        <YAxis yAxisId="left"  orientation="left"  tick={{ fontSize: 10, fill: "#66625e" }} axisLine={false} tickLine={false}
               label={{ value: "Treated", angle: -90, position: "insideLeft", offset: 10, fontSize: 9, fill: "#66625e" }} />
        <YAxis yAxisId="right" orientation="right" domain={[0, 105]} tick={{ fontSize: 10, fill: "#66625e" }} axisLine={false} tickLine={false}
               label={{ value: "Cumulative %", angle: 90, position: "insideRight", offset: 10, fontSize: 9, fill: "#66625e" }} />
        <Tooltip
          contentStyle={{ borderRadius: 6, border: "1px solid #e3ddd3", fontSize: 11 }}
          formatter={(v, n) => (n === "Cumulative %" ? [`${v}%`, n] : [fmt(v), n])}
        />
        <ReferenceLine yAxisId="right" y={100} stroke="#8a7615" strokeDasharray="3 3" />
        <Bar yAxisId="left" dataKey="treated_in_round" name="Treated this round" fill="#f0d860" radius={[4, 4, 0, 0]} />
        <Line yAxisId="right" type="monotone" dataKey="cumulative_pct" name="Cumulative %" stroke="#8a7615" strokeWidth={2.4} dot={{ r: 4, fill: "#8a7615" }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
