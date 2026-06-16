import React from "react";

export default function Delta({ pct, invert = false }) {
  if (pct == null || isNaN(pct)) return null;
  const rounded = Math.round(pct);
  if (rounded === 0) return null;
  const up = rounded > 0;
  const isGood = invert ? !up : up;
  const cls = isGood ? "delta delta--up" : "delta delta--down";
  return (
    <span className={cls} aria-label={`${rounded}% change`}>
      {up ? "↑" : "↓"}{Math.abs(rounded)}%
    </span>
  );
}
