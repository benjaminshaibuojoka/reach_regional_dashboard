import React, { useEffect, useState } from "react";
import { useHover } from "../context/HoverContext.jsx";
import { apiFetch, apiRoot as root } from "../http.js";

function colorFor(pct) {
  if (pct == null) return "#f3f0ea";
  if (pct >= 95) return "#8a7615";
  if (pct >= 80) return "#b89e1d";
  if (pct >= 60) return "#e3c934";
  if (pct >= 40) return "#f0d860";
  if (pct >= 20) return "#f7e89a";
  return "#fdf4cd";
}

export default function IntensityHeatmap({ country }) {
  const { hovered, setHovered } = useHover();
  const [data, setData] = useState(null);
  useEffect(() => {
    if (!country) return;
    apiFetch(`${root}/intensity-heatmap?country=${country}`)
      .then(r => r.json()).then(setData).catch(() => setData(null));
  }, [country]);
  if (!data?.matrix?.length) return null;

  return (
    <div className="hmap" style={{ "--cols": data.rounds.length }}>
      <div className="hmap__head" style={{ "--cols": data.rounds.length }}>
        <div />
        {data.rounds.map(r => (
          <div key={r} className="hmap__col-hd">R{r}</div>
        ))}
      </div>
      {data.matrix.map(row => {
        const isHovered = hovered === row.state;
        return (
          <div
            key={row.state}
            className={`hmap__row ${isHovered ? "hmap__row--on" : ""}`}
            style={{ "--cols": data.rounds.length }}
            onMouseEnter={() => setHovered(row.state)}
            onMouseLeave={() => setHovered(null)}
          >
            <div className="hmap__row-hd">{row.state}</div>
            {row.values.map((v, i) => (
              <div key={i} className="hmap__cell"
                   style={{ background: colorFor(v) }}
                   title={`${row.state} · Round ${data.rounds[i]}: ${v == null ? "no data" : v + "%"}`}>
                {v != null && <span>{v}</span>}
              </div>
            ))}
          </div>
        );
      })}
      <div className="hmap__legend">
        <span>0</span>
        <span className="hmap__leg-bar" />
        <span>100+%</span>
      </div>
    </div>
  );
}
