import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch, apiRoot as root } from "../http.js";

const SCOPES = ["REGIONAL", "NIGERIA", "NIGER", "MALI"];
const FORMATS = ["pdf", "docx", "csv"];
const CADENCES = ["daily", "weekly", "monthly"];
const METRICS = ["percentage", "treated", "eligible", "sae", "deaths"];

const IconReports = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7h18M6 11h12M9 15h6M5 19h14"/>
  </svg>
);
const IconAlert = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.7 21a2 2 0 0 1-3.4 0"/>
  </svg>
);

function EmailsInput({ value, onChange, placeholder }) {
  const [draft, setDraft] = useState("");
  const add = (s) => {
    const e = (s || "").trim().replace(/,$/, "");
    if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return;
    if (value.includes(e)) { setDraft(""); return; }
    onChange([...value, e]); setDraft("");
  };
  const onKey = (e) => {
    if (e.key === "Enter" || e.key === "," || e.key === "Tab") { e.preventDefault(); add(draft); }
    else if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
  };
  return (
    <div className="emails-input" onClick={(e) => e.currentTarget.querySelector("input")?.focus()}>
      {value.map((em) => (
        <span key={em} className="email-chip">
          {em}
          <button type="button" onClick={(e) => { e.stopPropagation(); onChange(value.filter(x => x !== em)); }}>×</button>
        </span>
      ))}
      <input
        type="email"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKey}
        onBlur={() => add(draft)}
        placeholder={value.length ? "" : placeholder}
      />
    </div>
  );
}

function ScopesPicker({ value, onChange }) {
  const toggle = (s) => onChange(value.includes(s) ? value.filter(x => x !== s) : [...value, s]);
  return (
    <div className="scope-picker">
      {SCOPES.map((s) => (
        <button key={s} type="button"
          className={`scope-pill ${value.includes(s) ? "scope-pill--on" : ""}`}
          onClick={() => toggle(s)}>{s}</button>
      ))}
    </div>
  );
}

export default function Subscriptions({ defaultScope = "REGIONAL", onClose }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState("reports");
  const [reports, setReports] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [msg, setMsg] = useState("");
  const [msgKind, setMsgKind] = useState("info"); // info | ok | warn | err
  const [mailStatus, setMailStatus] = useState(null);

  const load = () => {
    apiFetch(`${root}/reports`).then(r => r.json()).then(setReports).catch(() => {});
    apiFetch(`${root}/alerts`).then(r => r.json()).then(setAlerts).catch(() => {});
  };
  useEffect(() => {
    load();
    apiFetch(`${root}/mail-status`).then(r => r.json()).then(setMailStatus).catch(() => {});
  }, []);

  const [r, setR] = useState({
    emails: [], scopes: [defaultScope],
    format: "pdf", cadence: "weekly",
    send_time: "08:00",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Lagos",
  });
  const [a, setA] = useState({ email: "", metric: "percentage", comparison: "lt", threshold: 80, scope: defaultScope });

  const submitReport = async (e) => {
    e.preventDefault(); setMsg(""); setMsgKind("info");
    if (r.emails.length === 0 || r.scopes.length === 0) {
      setMsg(t("subs_err")); setMsgKind("err"); return;
    }
    const res = await apiFetch(`${root}/reports`, {
      method: "POST", body: JSON.stringify(r),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg(data.detail || t("subs_err")); setMsgKind("err"); return; }
    setMsg(data.note || t("subs_ok_report"));
    setMsgKind(data.mail_sent ? "ok" : "warn");
    setR({ ...r, emails: [] });
    load();
  };

  const submitAlert = async (e) => {
    e.preventDefault(); setMsg(""); setMsgKind("info");
    const res = await apiFetch(`${root}/alerts`, {
      method: "POST", body: JSON.stringify(a),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg(data.detail || t("subs_err")); setMsgKind("err"); return; }
    setMsg(data.note || t("subs_ok_alert"));
    setMsgKind(data.mail_sent ? "ok" : "warn");
    setA({ ...a, email: "" });
    load();
  };

  const del = async (kind, id) => { await apiFetch(`${root}/${kind}/${id}`, { method: "DELETE" }); load(); };

  return (
    <>
      <div className="chatbot-backdrop" onClick={onClose} />
      <aside
        className="ai-drawer"
        role="dialog"
        aria-modal
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
            <div className="chatbot-title">{t("subs_title")}</div>
            <div className="chatbot-sub">{t("ai_sub_subs")}</div>
          </div>
          <button className="chatbot-close" onClick={onClose} aria-label="Close">×</button>
        </header>

        <div className="ai-tabs">
          <button className={tab==="reports"?"ai-tab ai-tab--on":"ai-tab"} onClick={() => setTab("reports")}>
            <IconReports /> {t("subs_tab_reports")}
          </button>
          <button className={tab==="alerts"?"ai-tab ai-tab--on":"ai-tab"} onClick={() => setTab("alerts")}>
            <IconAlert /> {t("subs_tab_alerts")}
          </button>
        </div>

        <div className="subs-body">
          {mailStatus && !mailStatus.configured && (
            <div className="subs-banner subs-banner--warn" role="status">
              <b>{t("subs_smtp_off_title")}</b>
              <div>{t("subs_smtp_off_body")}</div>
            </div>
          )}
          {mailStatus?.configured && (
            <div className="subs-banner subs-banner--ok" role="status">
              <b>{t("subs_smtp_on_title")}</b>
              <div>{t("subs_smtp_on_body", { host: mailStatus.host, from: mailStatus.from })}</div>
            </div>
          )}

          {tab === "reports" && (
            <>
              <div className="tab-hint">{t("subs_hint_reports")}</div>
              <form onSubmit={submitReport} className="form-stack">
                <label className="field">
                  <span className="field__label">{t("subs_emails")}</span>
                  <EmailsInput value={r.emails} onChange={(v) => setR({...r, emails: v})}
                               placeholder="you@example.org, second@team.org" />
                  <span className="field__hint">{t("subs_emails_hint")}</span>
                </label>
                <label className="field">
                  <span className="field__label">{t("subs_scopes")}</span>
                  <ScopesPicker value={r.scopes} onChange={(v) => setR({...r, scopes: v})} />
                </label>
                <div className="grid-2">
                  <label className="field">
                    <span className="field__label">{t("subs_format")}</span>
                    <select className="field__input" value={r.format} onChange={e=>setR({...r,format:e.target.value})}>
                      {FORMATS.map(s => <option key={s} value={s}>{t(`download_${s}`).toUpperCase()}</option>)}
                    </select>
                  </label>
                  <label className="field">
                    <span className="field__label">{t("subs_cadence")}</span>
                    <select className="field__input" value={r.cadence} onChange={e=>setR({...r,cadence:e.target.value})}>
                      {CADENCES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </label>
                  <label className="field">
                    <span className="field__label">{t("subs_send_time")}</span>
                    <input type="time" className="field__input"
                           value={r.send_time}
                           onChange={e => setR({ ...r, send_time: e.target.value })} />
                    <span className="field__hint">{t("subs_send_time_hint", { tz: r.timezone })}</span>
                  </label>
                  <label className="field">
                    <span className="field__label">{t("subs_timezone")}</span>
                    <input type="text" className="field__input"
                           value={r.timezone}
                           onChange={e => setR({ ...r, timezone: e.target.value })}
                           placeholder="Africa/Lagos" />
                  </label>
                </div>
                <button className="login-btn" type="submit">{t("subs_schedule")}</button>
              </form>

              <h4 className="modal__list-title">{t("subs_scheduled")}</h4>
              <ul className="sub-list">
                {reports.length === 0 && <li className="sub-list__empty">{t("subs_none_reports")}</li>}
                {reports.map(x => (
                  <li key={x.id} className="sub-list__item">
                    <div>
                      <div><b>{x.email}</b></div>
                      <div className="sub-list__meta">
                        {x.scope} · {String(x.format).toUpperCase()} · {x.cadence}
                        {x.send_time && <> · {x.send_time}{x.timezone ? ` (${x.timezone})` : ""}</>}
                      </div>
                    </div>
                    <button className="link-danger" onClick={() => del("reports", x.id)}>{t("subs_remove")}</button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {tab === "alerts" && (
            <>
              <div className="tab-hint">{t("subs_hint_alerts")}</div>
              <form className="form-stack" onSubmit={submitAlert}>
                <label className="field">
                  <span className="field__label">Email</span>
                  <input type="email" required value={a.email} onChange={e=>setA({...a,email:e.target.value})} className="field__input" placeholder="you@example.org" />
                </label>
                <div className="grid-2">
                  <label className="field">
                    <span className="field__label">{t("subs_scopes")}</span>
                    <select className="field__input" value={a.scope} onChange={e=>setA({...a,scope:e.target.value})}>
                      {SCOPES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </label>
                  <label className="field">
                    <span className="field__label">{t("subs_metric")}</span>
                    <select className="field__input" value={a.metric} onChange={e=>setA({...a,metric:e.target.value})}>
                      {METRICS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </label>
                  <label className="field">
                    <span className="field__label">{t("subs_when")}</span>
                    <select className="field__input" value={a.comparison} onChange={e=>setA({...a,comparison:e.target.value})}>
                      <option value="lt">{t("subs_when_lt")}</option>
                      <option value="gt">{t("subs_when_gt")}</option>
                    </select>
                  </label>
                  <label className="field">
                    <span className="field__label">{t("subs_threshold")}</span>
                    <input type="number" step="0.1" required value={a.threshold} onChange={e=>setA({...a,threshold:parseFloat(e.target.value)})} className="field__input" />
                  </label>
                </div>
                <button className="login-btn" type="submit">{t("subs_arm")}</button>
              </form>

              <h4 className="modal__list-title">{t("subs_active_alerts")}</h4>
              <ul className="sub-list">
                {alerts.length === 0 && <li className="sub-list__empty">{t("subs_none_alerts")}</li>}
                {alerts.map(x => (
                  <li key={x.id} className="sub-list__item">
                    <div>
                      <div><b>{x.email}</b></div>
                      <div className="sub-list__meta">{x.scope} · {x.metric} {x.comparison==="lt"?"<":">"} {x.threshold}</div>
                    </div>
                    <button className="link-danger" onClick={() => del("alerts", x.id)}>{t("subs_remove")}</button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {msg && (
            <div className={`subs-msg subs-msg--${msgKind}`} role="status">
              {msg}
            </div>
          )}
        </div>

        <footer className="ai-foot">
          <button className="modal__ok" onClick={onClose}>{t("ok")}</button>
        </footer>
      </aside>
    </>
  );
}
