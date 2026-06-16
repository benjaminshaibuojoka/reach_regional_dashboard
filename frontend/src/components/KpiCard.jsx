import React from "react";
import Delta from "./Delta.jsx";
import MethodologyDrawer from "./MethodologyDrawer.jsx";

export default function KpiCard({
  icon: Icon, value, label,
  deltaPct, invertDelta = false, insight, indicator,
  approximate = false,           // shows ≈ before the value (modelled estimates)
}) {
  return (
    <div className="kpi" tabIndex={0} aria-label={label}>
      <div className="kpi__icon" aria-hidden="true">
        <Icon size={16} stroke="currentColor" />
      </div>
      <div className="kpi__body">
        <div className="kpi__row">
          <div className="kpi__value">
            {approximate && <span className="kpi__approx" aria-hidden="true">≈ </span>}
            {value}
            {approximate && <sup className="kpi__star" title="Modelled estimate — see Methods">*</sup>}
          </div>
          <Delta pct={deltaPct} invert={invertDelta} />
        </div>
        <div className="kpi__label">
          {label}
          {indicator && <MethodologyDrawer indicator={indicator} label={label} />}
        </div>
      </div>
      {insight && (
        <div className="kpi__insight" role="tooltip">
          <span className="kpi__insight-badge">AI</span>
          {insight}
        </div>
      )}
    </div>
  );
}
