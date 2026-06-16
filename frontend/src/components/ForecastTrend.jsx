import React, { useEffect, useState } from "react";
import {
  ComposedChart, Area, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine, ReferenceArea, Legend,
} from "recharts";
import { useTranslation } from "react-i18next";

import { apiFetch, apiRoot as root, qs } from "../http.js";

export default function ForecastTrend({ country }) {
  const { t } = useTranslation();
  const [data, setData] = useState(null);

  useEffect(() => {
    apiFetch(`${root}/forecast${qs({ country, horizon: 2 })}`)
      .then(r => r.json()).then(setData).catch(() => setData(null));
  }, [country]);

  if (!data) return <div style={{padding:8, color:"#66625e", fontSize:11}}>—</div>;

  const merged = [
    ...data.history.map(p => ({ ...p, kind: "actual" })),
    ...data.forecast.map(p => ({ ...p, kind: "forecast" })),
  ];
  const firstForecast = data.forecast[0]?.quarter;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={merged} margin={{ top: 14, right: 28, bottom: 4, left: 28 }}>
        <defs>
          <linearGradient id="actualFade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e3c934" stopOpacity={0.32} />
            <stop offset="100%" stopColor="#e3c934" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#f3f0ea" vertical={false} />
        <XAxis dataKey="quarter" tickLine={false} axisLine={{ stroke: "#e3ddd3" }} tick={{ fontSize: 11, fill: "#66625e" }} padding={{ left: 12, right: 12 }} />
        <YAxis domain={[0, 110]} tick={{ fontSize: 10, fill: "#66625e" }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ borderRadius: 6, border: "1px solid #e3ddd3", fontSize: 11 }}
          labelStyle={{ color: "#45423f", fontWeight: 700 }}
          formatter={(v, n) => [`${v}%`, n]}
        />
        <ReferenceLine y={80} stroke="#8a7615" strokeDasharray="3 3" strokeWidth={1}
                       label={{ value: "WHO 80% target", position: "insideTopRight", fontSize: 9, fill: "#8a7615" }} />
        {firstForecast && <ReferenceArea x1={firstForecast} fill="#fef9e0" fillOpacity={0.6} />}

        {/* 95% PI band */}
        <Area dataKey="ci95_hi" stroke={false} fill="#f0d860" fillOpacity={0.18} name="95% PI" />
        <Area dataKey="ci95_lo" stroke={false} fill="#ffffff" fillOpacity={1} legendType="none" />

        {/* 80% PI band (darker) */}
        <Area dataKey="ci80_hi" stroke={false} fill="#e3c934" fillOpacity={0.22} name="80% PI" />
        <Area dataKey="ci80_lo" stroke={false} fill="#ffffff" fillOpacity={1} legendType="none" />

        {/* Historical fill */}
        <Area dataKey="percentage" type="monotone" stroke="#b89e1d" strokeWidth={2.4}
              fill="url(#actualFade)"
              dot={(props) => {
                const isFc = props?.payload?.is_forecast;
                return (
                  <circle cx={props.cx} cy={props.cy} r={4}
                    fill={isFc ? "#ffffff" : "#b89e1d"}
                    stroke={isFc ? "#b89e1d" : "#ffffff"} strokeWidth={2} />
                );
              }}
              name={t("kpi_percentage")} />
        <Legend wrapperStyle={{ fontSize: 10 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
