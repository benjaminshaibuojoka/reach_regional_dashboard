import React, { useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useHover } from "../context/HoverContext.jsx";

const fmt = (n) => Number(n || 0).toLocaleString();

// Wilson score 95% CI for a proportion p̂ = x/n.
// Standard small-sample CI used in epidemiology (DHS, WHO).
function wilsonCI(x, n, z = 1.96) {
  if (!n || n <= 0) return null;
  const p = x / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n)) / denom;
  return {
    lo: Math.max(0, Math.round((centre - margin) * 1000) / 10),
    hi: Math.min(100, Math.round((centre + margin) * 1000) / 10),
  };
}

export default function HorizontalBars({
  rows = [],
  labelKey = "country",
  showLegend = true,
  onRowClick,
  selected = null,
}) {
  const { t } = useTranslation();
  const max = Math.max(1, ...rows.map((r) => Math.max(r.eligible || 0, r.treated || 0)));
  const clickable = !!onRowClick;
  const [tip, setTip] = useState(null);   // {row, x, y}
  const sel = selected ? String(selected).toUpperCase() : null;
  const { hovered, setHovered } = useHover();

  const showTip = (r, e) => {
    setTip({ r, x: e.clientX + 14, y: e.clientY + 14 });
    setHovered(r[labelKey]);
  };
  const hideTip = () => { setTip(null); setHovered(null); };

  return (
    <div className="hbars-wrap">
      {showLegend && (
        <div style={{display:"flex", justifyContent:"flex-end", marginBottom: 6}}>
          <div className="legend-inline">
            <span><span className="sw" style={{background:"#b9bcc2"}} />{t("legend_eligible")}</span>
            <span><span className="sw" style={{background:"linear-gradient(90deg,var(--gold-500),var(--gold-600))"}} />{t("legend_treated")}</span>
          </div>
        </div>
      )}
      <div className="hbars">
        {rows.map((r) => {
          const pE = (r.eligible / max) * 100;
          const pT = (r.treated / max) * 100;
          const name = r[labelKey];
          const isSelected = sel && String(name).toUpperCase() === sel;
          const isHovered = hovered && String(hovered).toUpperCase() === String(name).toUpperCase();
          return (
            <div
              key={name}
              className={`hbar ${clickable ? "hbar--click" : ""} ${isSelected ? "hbar--on" : ""} ${isHovered ? "hbar--linked" : ""}`}
              onClick={clickable ? () => onRowClick(r) : undefined}
              role={clickable ? "button" : undefined}
              tabIndex={clickable ? 0 : undefined}
              onKeyDown={clickable ? (e) => { if (e.key === "Enter" || e.key === " ") onRowClick(r); } : undefined}
              onMouseEnter={(e) => showTip(r, e)}
              onMouseMove={(e) => showTip(r, e)}
              onMouseLeave={hideTip}
              onFocus={(e) => showTip(r, { clientX: e.target.getBoundingClientRect().right - 60, clientY: e.target.getBoundingClientRect().top })}
              onBlur={hideTip}
            >
              <div className="hbar__label" title={name}>
                {name}{isSelected && <span className="hbar__on-mark"> ✕</span>}
              </div>
              <div className="hbar__track">
                <div className="hbar__eligible" style={{ width: `${pE}%` }} />
                <div className="hbar__treated"  style={{ width: `${pT}%` }}>{fmt(r.treated)}</div>
              </div>
              <div className="hbar__end">{fmt(r.eligible)}</div>
            </div>
          );
        })}
      </div>

      {tip && createPortal(
        (() => {
          const ci = wilsonCI(tip.r.treated, tip.r.eligible);
          return (
            <div className="hbar__tip" role="tooltip" style={{ left: tip.x, top: tip.y }}>
              <div className="hbar__tip-row">
                <span>{tip.r[labelKey]}</span><b>{tip.r.percentage}%</b>
              </div>
              <div className="hbar__tip-meta">
                {t("legend_treated")}: <b>{fmt(tip.r.treated)}</b><br/>
                {t("legend_eligible")}: <b>{fmt(tip.r.eligible)}</b><br/>
                {ci && <>95% CI: <b>{ci.lo}% – {ci.hi}%</b></>}
              </div>
            </div>
          );
        })(),
        document.body
      )}
    </div>
  );
}
