import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch, apiRoot as root } from "../http.js";
const fmt = (n) => Number(n || 0).toLocaleString();
const REC_ICONS = { high: "⚠", medium: "◆", info: "✦" };

const Spark = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v3" /><path d="M12 18v3" /><path d="M3 12h3" /><path d="M18 12h3" />
    <path d="M5.6 5.6l2.1 2.1" /><path d="M16.3 16.3l2.1 2.1" />
    <path d="M5.6 18.4l2.1-2.1" /><path d="M16.3 7.7l2.1-2.1" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const IconChat = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 11.5a8.38 8.38 0 0 1-3.8 7l.8 4-4.3-1.5A8.38 8.38 0 0 1 3 11.5 8.5 8.5 0 0 1 11.5 3 8.5 8.5 0 0 1 21 11.5Z"/>
  </svg>
);
const IconBulb = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18h6"/><path d="M10 22h4"/>
    <path d="M12 2a7 7 0 0 0-4 12c1 1 2 2 2 4h4c0-2 1-3 2-4a7 7 0 0 0-4-12Z"/>
  </svg>
);
const IconFlask = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 2v6L3 20a2 2 0 0 0 2 3h14a2 2 0 0 0 2-3L15 8V2"/>
    <line x1="9" y1="2" x2="15" y2="2"/>
  </svg>
);

export default function AIAssistant({ scope = {}, variant = "header", forceOpen = false, onClose }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(forceOpen);
  const [tab, setTab] = useState("chat");

  // Chat
  const [msgs, setMsgs] = useState([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);
  const scrollRef = useRef(null);

  // Recommendations
  const [recs, setRecs] = useState([]);

  // What-If
  const [s, setS] = useState({ coverage_uplift_pct: 0, reporting_uplift_pct: 0, staff_uplift_pct: 0, facility_uplift_pct: 0 });
  const [out, setOut] = useState(null);
  const [wBusy, setWBusy] = useState(false);

  // refresh intro greeting on language change
  useEffect(() => { setMsgs([{ role: "bot", text: t("ai_intro") }]); }, [t]);

  useEffect(() => {
    if (!open) return;
    if (tab === "chat") inputRef.current?.focus();
    if (tab === "recs") {
      const u = new URLSearchParams();
      if (scope.country) u.set("country", scope.country);
      apiFetch(`${root}/recommendations${u.toString() ? "?" + u : ""}`).then(r => r.json()).then(setRecs).catch(() => setRecs([]));
    }
    if (tab === "whatif") runWhatif();
    // eslint-disable-next-line
  }, [open, tab]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs, open, tab]);

  const send = async (question) => {
    const text = (question ?? q).trim();
    if (!text || busy) return;
    setMsgs((m) => [...m, { role: "me", text }]);
    setQ(""); setBusy(true);
    try {
      const r = await apiFetch(`${root}/chat`, {
        method: "POST",
        body: JSON.stringify({ question: text, country: scope.country, state: scope.state, lga: scope.lga }),
      });
      const d = await r.json();
      setMsgs((m) => [...m, { role: "bot", text: d.answer || "—" }]);
    } catch {
      setMsgs((m) => [...m, { role: "bot", text: "Backend error — try again." }]);
    } finally { setBusy(false); }
  };

  const runWhatif = async () => {
    setWBusy(true);
    try {
      const r = await apiFetch(`${root}/whatif`, {
        method: "POST",
        body: JSON.stringify({ ...scope, ...s }),
      });
      setOut(await r.json());
    } finally { setWBusy(false); }
  };
  useEffect(() => { if (open && tab === "whatif") runWhatif(); /* eslint-disable-next-line */ },
    [s.coverage_uplift_pct, s.reporting_uplift_pct, s.staff_uplift_pct, s.facility_uplift_pct, scope.country, scope.state, scope.lga]);
  const resetWhatif = () => setS({ coverage_uplift_pct: 0, reporting_uplift_pct: 0, staff_uplift_pct: 0, facility_uplift_pct: 0 });

  const SUGGESTIONS = [t("ai_suggest_1"), t("ai_suggest_2"), t("ai_suggest_3")];

  const close = () => { setOpen(false); onClose?.(); };

  return (
    <>
      {!forceOpen && (
        <button
          className={variant === "header" ? "icon-btn ai-btn" : "ai-fab"}
          onClick={() => setOpen(true)}
          title={t("ai_title")}
          aria-label={t("ai_title")}
        >
          <Spark size={variant === "header" ? 16 : 18} />
          {variant !== "header" && <span className="ai-fab__pulse" />}
          {recs.length > 0 && <span className={variant === "header" ? "ai-btn__dot" : "ai-fab__dot"}>{recs.length}</span>}
        </button>
      )}

      {open && (
        <>
          <div className="chatbot-backdrop" onClick={close} />
          <aside
            className="ai-drawer"
            style={{ backgroundColor: "#ffffff" }}
          >
            <div
              className="ai-drawer__bg"
              aria-hidden="true"
              style={{
                position: "absolute",
                top: 0, left: 0, right: 0, bottom: 0,
                width: "100%",
                height: "100%",
                backgroundColor: "#ffffff",
                zIndex: 0,
                pointerEvents: "none",
              }}
            />
            <header className="chatbot-head">
              <div>
                <div className="chatbot-title">{t("ai_title")}</div>
                <div className="chatbot-sub">{t("ai_sub")}</div>
              </div>
              <button className="chatbot-close" onClick={close} aria-label="Close">×</button>
            </header>

            <div className="ai-tabs">
              <button className={tab==="chat"?"ai-tab ai-tab--on":"ai-tab"} onClick={() => setTab("chat")}><IconChat /> {t("ai_tab_ask")}</button>
              <button className={tab==="recs"?"ai-tab ai-tab--on":"ai-tab"} onClick={() => setTab("recs")}><IconBulb /> {t("ai_tab_insights")}</button>
            </div>

            {tab === "chat" && (
              <>
                <div className="tab-hint">{t("ai_hint_ask")}</div>
                <div className="chatbot-body" ref={scrollRef}>
                  {msgs.map((m, i) => (<div key={i} className={`bubble bubble--${m.role}`}>{m.text}</div>))}
                  {busy && <div className="bubble bubble--bot bubble--typing">…</div>}
                </div>
                <div className="chatbot-suggest">
                  {SUGGESTIONS.map(x => (<button key={x} className="chip" onClick={() => send(x)}>{x}</button>))}
                </div>
                <form className="chatbot-form" onSubmit={(e) => { e.preventDefault(); send(); }}>
                  <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)}
                         placeholder={t("ai_placeholder")} className="chatbot-input" />
                  <button className="chatbot-send" disabled={busy || !q.trim()}>{t("ai_send")}</button>
                </form>
              </>
            )}

            {tab === "recs" && (
              <div className="recs-drawer__body">
                <div className="tab-hint">{t("ai_hint_insights")}</div>
                {recs.length === 0 && <div className="recs-empty">{t("ai_no_recs")}</div>}
                {recs.map((r, i) => (
                  <div key={i} className={`rec rec--${r.level}`}>
                    <span className="rec__icon" aria-hidden>{REC_ICONS[r.level] || "•"}</span>
                    <div>
                      <div className="rec__title">{r.title}</div>
                      <div className="rec__detail">{r.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === "whatif" && (
              <div className="whatif-body ai-tab-body">
                <div className="tab-hint">{t("ai_hint_whatif")}</div>
                <Slider label={t("whatif_coverage_uplift")} hint={t("whatif_coverage_hint")} value={s.coverage_uplift_pct} min={0} max={20} step={0.5} unit=" pts" onChange={v => setS({...s, coverage_uplift_pct: v})} />
                <Slider label={t("whatif_reporting")} hint={t("whatif_reporting_hint")} value={s.reporting_uplift_pct} min={0} max={30} step={1} unit="%" onChange={v => setS({...s, reporting_uplift_pct: v})} />
                <Slider label={t("whatif_staff")} hint={t("whatif_staff_hint")} value={s.staff_uplift_pct} min={0} max={30} step={1} unit="%" onChange={v => setS({...s, staff_uplift_pct: v})} />
                <Slider label={t("whatif_facility")} hint={t("whatif_facility_hint")} value={s.facility_uplift_pct} min={0} max={30} step={1} unit="%" onChange={v => setS({...s, facility_uplift_pct: v})} />
                <button className="reset-link" onClick={resetWhatif}>{t("whatif_reset")}</button>
                {out && (
                  <div className="whatif-out">
                    <h4>{t("whatif_title")}</h4>
                    <Row label={t("kpi_treated")}   base={out.baseline.treated}      proj={out.projection.treated}    extra={out.delta.treated_extra} fmt={fmt} />
                    <Row label={t("kpi_percentage")} base={`${out.baseline.percentage}%`} proj={`${out.projection.percentage}%`} extra={`${out.delta.percentage_pts > 0 ? "+" : ""}${out.delta.percentage_pts} pts`} />
                    <Row label={t("kpi_deaths_averted")} base={out.baseline.deaths_averted} proj={out.projection.deaths_averted} extra={out.delta.deaths_extra} fmt={fmt} />
                    <p className="whatif-note">{t("whatif_note")}</p>
                  </div>
                )}
                {wBusy && <div style={{textAlign:"center", color:"#6b7280", padding:"6px"}}>…</div>}
              </div>
            )}
            <footer className="ai-foot">
              <button className="modal__ok" onClick={close}>{t("ok")}</button>
            </footer>
          </aside>
        </>
      )}
    </>
  );
}

function Slider({ label, hint, value, onChange, min, max, step, unit = "%" }) {
  return (
    <div className="slider">
      <div className="slider__head">
        <span className="slider__label">{label}</span>
        <span className="slider__value">+{value}{unit}</span>
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
        <span className={`whatif-row__extra ${isPositive ? "up" : ""}`}>
          {typeof extra === "number" ? `+${f(extra)}` : extra}
        </span>
      </div>
    </div>
  );
}
