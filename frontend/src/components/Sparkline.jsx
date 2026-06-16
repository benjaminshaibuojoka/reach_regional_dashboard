import React from "react";

export default function Sparkline({
  values = [],
  width = 48,
  height = 10,
  color = "#9ca3af",
  amplitude = 0.45, // fraction of the available height the line is allowed to span
}) {
  if (!values || values.length < 2) return <svg width={width} height={height} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const usable = (height - 2) * amplitude;
  const midY = height / 2;
  const stepX = width / (values.length - 1);
  const points = values.map((v, i) => {
    const norm = (v - min) / range;     // 0..1
    const centered = norm - 0.5;         // -0.5..0.5
    return [i * stepX, midY - centered * usable];
  });
  const path = points
    .map(([x, y], i) => (i === 0 ? `M${x.toFixed(1)},${y.toFixed(1)}` : `L${x.toFixed(1)},${y.toFixed(1)}`))
    .join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="sparkline" aria-hidden>
      <path d={path} fill="none" stroke={color} strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round" opacity="0.45" />
    </svg>
  );
}
