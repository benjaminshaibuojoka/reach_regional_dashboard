import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch, apiRoot as root } from "../http.js";

const Icon = (props) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M21 11.5a8.38 8.38 0 0 1-3.8 7l.8 4-4.3-1.5A8.38 8.38 0 0 1 3 11.5 8.5 8.5 0 0 1 11.5 3 8.5 8.5 0 0 1 21 11.5Z"/>
  </svg>
);

const SUGGESTIONS = [
  "Which country has the highest coverage?",
  "What is Nigeria's trend over time?",
  "Which state in Nigeria has the lowest coverage?",
  "How many children were treated in Mali?",
  "What is the percentage treated in Niger?",
];

export default function Chatbot({ scope = {} }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([
    { role: "bot", text: "Hi! Ask me anything about coverage, eligible/treated children, adverse events or deaths averted." },
  ]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs, open]);

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
      setMsgs((m) => [...m, { role: "bot", text: d.answer || "Sorry, I couldn't answer that." }]);
    } catch {
      setMsgs((m) => [...m, { role: "bot", text: "Backend error — try again." }]);
    } finally { setBusy(false); }
  };

  return (
    <>
      <button className="chatbot-fab" onClick={() => setOpen(true)} aria-label="Open chat" title="Ask REACH AI">
        <Icon />
        <span className="chatbot-fab__pulse" />
      </button>
      {open && (
        <>
          <div className="chatbot-backdrop" onClick={() => setOpen(false)} />
          <aside className="chatbot-drawer">
            <header className="chatbot-head">
              <div>
                <div className="chatbot-title">REACH Assistant</div>
                <div className="chatbot-sub">Ask in plain English or French</div>
              </div>
              <button className="chatbot-close" onClick={() => setOpen(false)} aria-label="Close">×</button>
            </header>
            <div className="chatbot-body" ref={scrollRef}>
              {msgs.map((m, i) => (
                <div key={i} className={`bubble bubble--${m.role}`}>{m.text}</div>
              ))}
              {busy && <div className="bubble bubble--bot bubble--typing">…</div>}
            </div>
            <div className="chatbot-suggest">
              {SUGGESTIONS.slice(0, 3).map(s => (
                <button key={s} className="chip" onClick={() => send(s)}>{s}</button>
              ))}
            </div>
            <form className="chatbot-form" onSubmit={(e) => { e.preventDefault(); send(); }}>
              <input
                ref={inputRef}
                value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="Ask a question…"
                className="chatbot-input"
              />
              <button className="chatbot-send" disabled={busy || !q.trim()}>Send</button>
            </form>
          </aside>
        </>
      )}
    </>
  );
}
