import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { apiFetch, apiRoot as root } from "../http.js";

const InfoIcon = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

export default function MethodologyDrawer({ indicator, label }) {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language || "en").slice(0, 2);
  const [open, setOpen] = useState(false);
  const [meta, setMeta] = useState(null);

  // Re-fetch whenever the drawer is opened OR the active language changes.
  useEffect(() => {
    if (!open || !indicator) return;
    setMeta(null);
    apiFetch(`${root}/methodology/${indicator}?lang=${lang}`)
      .then(r => r.ok ? r.json() : null)
      .then(setMeta)
      .catch(() => setMeta(null));
  }, [open, indicator, lang]);

  return (
    <>
      <button className="methods-btn" onClick={(e) => { e.stopPropagation(); setOpen(true); }}
              title={t("methods_btn_title")} aria-label={t("methods_btn_title")}>
        <InfoIcon /> <span>{t("methods_btn")}</span>
      </button>
      {open && createPortal(
        <>
          <div className="modal-backdrop modal-backdrop--solid" onClick={() => setOpen(false)} />
          <aside className="ai-drawer" role="dialog" aria-modal
                 style={{ backgroundColor: "#ffffff" }}>
            <div className="ai-drawer__bg" aria-hidden="true" style={{
              position: "absolute", inset: 0, width: "100%", height: "100%",
              backgroundColor: "#ffffff", zIndex: 0, pointerEvents: "none",
            }} />
            <header className="chatbot-head">
              <div>
                <div className="chatbot-title">{t("methods_title")}</div>
                <div className="chatbot-sub">{label || meta?.title || indicator}</div>
              </div>
              <button className="chatbot-close" onClick={() => setOpen(false)} aria-label={t("close")}>×</button>
            </header>
            <div className="subs-body">
              {!meta && <div style={{padding:8, color:"#66625e", fontSize:12}}>…</div>}
              {meta && (
                <dl className="methods-dl">
                  <Row k={t("methods_definition")}  v={meta.definition} />
                  <Row k={t("methods_formula")}     v={meta.formula} mono />
                  <Row k={t("methods_numerator")}   v={meta.numerator} />
                  <Row k={t("methods_denominator")} v={meta.denominator} />
                  <Row k={t("methods_exclusions")}  v={meta.exclusions} />
                  <Row k={t("methods_source")}      v={meta.source} />
                  <Row k={t("methods_frequency")}   v={meta.frequency} />
                  {meta.assumptions?.length > 0 && (
                    <>
                      <dt>{t("methods_assumptions")}</dt>
                      <dd>
                        <ul style={{margin:0, paddingLeft:18}}>
                          {meta.assumptions.map((a, i) => (<li key={i}>{a}</li>))}
                        </ul>
                      </dd>
                    </>
                  )}
                  {meta.references?.length > 0 && (
                    <>
                      <dt>{t("methods_references")}</dt>
                      <dd>
                        <ul style={{margin:0, paddingLeft:18}}>
                          {meta.references.map((r, i) => (<li key={i}>{r}</li>))}
                        </ul>
                      </dd>
                    </>
                  )}
                </dl>
              )}
            </div>
            <footer className="ai-foot">
              <button className="modal__ok" onClick={() => setOpen(false)}>{t("close")}</button>
            </footer>
          </aside>
        </>,
        document.body
      )}
    </>
  );
}

function Row({ k, v, mono }) {
  if (!v || v === "—") return (
    <>
      <dt>{k}</dt>
      <dd className="methods-dl__dim">—</dd>
    </>
  );
  return (
    <>
      <dt>{k}</dt>
      <dd className={mono ? "methods-dl__mono" : undefined}>{v}</dd>
    </>
  );
}
