import React, { useEffect, useState } from "react";
import { apiFetch, apiRoot as root } from "../http.js";
const fmt = (n) => Number(n || 0).toLocaleString();

const FlaskIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 2v6L3 20a2 2 0 0 0 2 3h14a2 2 0 0 0 2-3L15 8V2" />
    <line x1="9" y1="2" x2="15" y2="2" />
  </svg>
);

export default function WhatIf({ scope = {} }) {
  const [open, setOpen] = useState(false);
  const [s, setS] = useState({ coverage_uplift_pct: 0, reporting_uplift_pct: 0, staff_uplift_pct: 0, facility_uplift_pct: 0 });
  const [out, setOut] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const r = await apiFetch(`${root}/whatif`, {
        method: "POST",
        body: JSON.stringify({ ...scope, ...s }),
      });
      setOut(await r.json());
    } finally { setBusy(false); }
  };

  // Auto-run when opened or sliders change
  useEffect(() => { if (open) run(); /* eslint-disable-next-line */ }, [open, s.coverage_uplift_pct, s.reporting_uplift_pct, s.staff_uplift_pct, s.facility_uplift_pct, scope.country, scope.state, scope.lga]);

  const reset = () => setS({ coverage_uplift_pct: 0, reporting_uplift_pct: 0, staff_uplift_pct: 0, facility_uplift_pct: 0 });

  return (
    <>
      <button className="whatif-fab" onClick={() => setOpen(true)} title="What-If Analysis" aria-label="What-If Analysis">
        <FlaskIcon />
      </button>
      {open && (
        <>
          <div className="chatbot-backdrop" onClick={() => setOpen(false)} />
          <aside className="whatif-drawer">
            <header className="chatbot-head">
              <div>
                <div className="chatbot-title">What-If Analysis</div>
                <div className="chatbot-sub">Project the impact of operational changes</div>
              </div>
              <button className="chatbot-close" onClick={() => setOpen(false)} aria-label="Close">×</button>
            </header>
            <div className="whatif-body">
              <Slider label="Coverage uplift (pts)" hint="Lift current % treated by N points" value={s.coverage_uplift_pct} min={0} max={20} step={0.5}
                      onChange={v => setS({...s, coverage_uplift_pct: v})} />
              <Slider label="Reporting completeness" hint="+N% to reported eligibles" value={s.reporting_uplift_pct} min={0} max={30} step={1}
                      onChange={v => setS({...s, reporting_uplift_pct: v})} />
              <Slider label="Staff capacity" hint="+N% throughput on treatment" value={s.staff_uplift_pct} min={0} max={30} step={1}
                      onChange={v => setS({...s, staff_uplift_pct: v})} />
              <Slider label="New facilities" hint="+N% additional reach" value={s.facility_uplift_pct} min={0} max={30} step={1}
                      onChange={v => setS({...s, facility_uplift_pct: v})} />
              <button className="reset-link" onClick={reset}>Reset assumptions</button>

              {out && (
                <div className="whatif-out">
                  <h4>Projected impact</h4>
                  <Row label="Children Treated"   base={out.baseline.treated}      proj={out.projection.treated}    extra={out.delta.treated_extra}    fmt={fmt} />
                  <Row label="Percentage Treated" base={`${out.baseline.percentage}%`} proj={`${out.projection.percentage}%`} extra={`${out.delta.percentage_pts > 0 ? "+" : ""}${out.delta.percentage_pts} pts`} />
                  <Row label="Est. Deaths Averted" base={out.baseline.deaths_averted} proj={out.projection.deaths_averted} extra={out.delta.deaths_extra} fmt={fmt} />
                  <p className="whatif-note">This is a deterministic projection — not a predictive model. Adjust assumptions to test plans before committing resources.</p>
                </div>
              )}
              {busy && <div style={{textAlign:"center", color:"#6b7280", padding:"6px"}}>Recalculating…</div>}
            </div>
          </aside>
        </>
      )}
    </>
  );
}

function Slider({ label, hint, value, onChange, min, max, step }) {
  return (
    <div className="slider">
      <div className="slider__head">
        <span className="slider__label">{label}</span>
        <span className="slider__value">+{value}{label.includes("Coverage") ? " pts" : "%"}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
             onChange={e => onChange(parseFloat(e.target.value))} className="slider__input" />
      <div className="slider__hint">{hint}</div>
    </div>
  );
}

function Row({ label, base, proj, extra, fmt }) {
  const f = fmt || ((x) => x);
  const isPositive = typeof extra === "string" ? extra.startsWith("+") : Number(extra) > 0;
  return (
    <div className="whatif-row">
      <div className="whatif-row__label">{label}</div>
      <div className="whatif-row__values">
        <span className="whatif-row__base">{f(base)}</span>
        <span className="whatif-row__arrow">→</span>
        <span className="whatif-row__proj">{f(proj)}</span>
        <span className={`whatif-row__extra ${isPositive ? "up" : ""}`}>{typeof extra === "number" ? `+${f(extra)}` : extra}</span>
      </div>
    </div>
  );
}
