import React, { useEffect, useState } from "react";
import { apiFetch, apiRoot as root } from "../http.js";

const ICONS = { high: "⚠", medium: "◆", info: "✦" };

const BulbIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18h6" />
    <path d="M10 22h4" />
    <path d="M12 2a7 7 0 0 0-4 12c1 1 2 2 2 4h4c0-2 1-3 2-4a7 7 0 0 0-4-12Z" />
  </svg>
);

export default function Recommendations({ country }) {
  const [recs, setRecs] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const u = new URLSearchParams();
    if (country) u.set("country", country);
    apiFetch(`${root}/recommendations${u.toString() ? "?" + u : ""}`)
      .then(r => r.json()).then(setRecs).catch(() => setRecs([]));
  }, [country]);

  return (
    <>
      <button className="recs-fab" onClick={() => setOpen(true)} aria-label="Smart recommendations" title="Smart Recommendations">
        <BulbIcon />
        {recs.length > 0 && <span className="recs-fab__dot">{recs.length}</span>}
      </button>
      {open && (
        <>
          <div className="chatbot-backdrop" onClick={() => setOpen(false)} />
          <aside className="recs-drawer">
            <header className="chatbot-head">
              <div>
                <div className="chatbot-title">Smart Recommendations</div>
                <div className="chatbot-sub">AI-generated next steps for the current scope</div>
              </div>
              <button className="chatbot-close" onClick={() => setOpen(false)} aria-label="Close">×</button>
            </header>
            <div className="recs-drawer__body">
              {recs.length === 0 && (
                <div className="recs-empty">No anomalies detected. Coverage is on track.</div>
              )}
              {recs.map((r, i) => (
                <div key={i} className={`rec rec--${r.level}`}>
                  <span className="rec__icon" aria-hidden>{ICONS[r.level] || "•"}</span>
                  <div>
                    <div className="rec__title">{r.title}</div>
                    <div className="rec__detail">{r.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </>
      )}
    </>
  );
}
