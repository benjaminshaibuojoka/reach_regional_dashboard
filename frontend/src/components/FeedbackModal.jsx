import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { auth } from "../auth.js";
import { apiFetch, apiRoot as root } from "../http.js";

const KINDS = [
  { code: "bug",     keyTitle: "feedback_kind_bug",     keyDesc: "feedback_kind_bug_desc" },
  { code: "feature", keyTitle: "feedback_kind_feature", keyDesc: "feedback_kind_feature_desc" },
  { code: "data",    keyTitle: "feedback_kind_data",    keyDesc: "feedback_kind_data_desc" },
  { code: "general", keyTitle: "feedback_kind_general", keyDesc: "feedback_kind_general_desc" },
];

export default function FeedbackModal({ open, onClose }) {
  const { t } = useTranslation();
  const [kind, setKind] = useState("general");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    setErr(""); setOk(false);
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      const res = await apiFetch(`${root}/feedback`, {
        method: "POST",
        body: JSON.stringify({
          kind, subject: subject.trim(), message: message.trim(),
          email: email.trim() || null,
          username: auth.getUser() || null,
          page: window.location.pathname,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setOk(true); setSubject(""); setMessage("");
    } catch {
      setErr(t("feedback_err"));
    } finally { setBusy(false); }
  };

  return createPortal(
    <>
      <div className="modal-backdrop modal-backdrop--solid" onClick={onClose} />
      <aside className="ai-drawer" role="dialog" aria-modal style={{ backgroundColor: "#ffffff" }}>
        <div className="ai-drawer__bg" aria-hidden="true" style={{
          position: "absolute", inset: 0, width: "100%", height: "100%",
          backgroundColor: "#ffffff", zIndex: 0, pointerEvents: "none",
        }} />

        <header className="chatbot-head">
          <div>
            <div className="chatbot-title">{t("feedback_title")}</div>
            <div className="chatbot-sub">{t("feedback_subtitle")}</div>
          </div>
          <button className="chatbot-close" onClick={onClose} aria-label={t("close")}>×</button>
        </header>

        <div className="subs-body">
          {ok ? (
            <div className="feedback-ok">
              <div className="feedback-ok__title">{t("feedback_ok_title")}</div>
              <div className="feedback-ok__sub">{t("feedback_ok_sub")}</div>
              <button className="login-btn" onClick={onClose} style={{marginTop:14}}>{t("close")}</button>
            </div>
          ) : (
            <form className="form-stack" onSubmit={submit}>
              <div className="field">
                <span className="field__label">{t("feedback_kind")}</span>
                <div className="kind-grid">
                  {KINDS.map(k => (
                    <button key={k.code} type="button"
                      className={`kind-card ${kind === k.code ? "kind-card--on" : ""}`}
                      onClick={() => setKind(k.code)}>
                      <div className="kind-card__title">{t(k.keyTitle)}</div>
                      <div className="kind-card__desc">{t(k.keyDesc)}</div>
                    </button>
                  ))}
                </div>
              </div>

              <label className="field">
                <span className="field__label">{t("feedback_subject")}</span>
                <input type="text" required maxLength={200} value={subject}
                       onChange={e => setSubject(e.target.value)}
                       className="field__input"
                       placeholder={t("feedback_subject_ph")} />
              </label>

              <label className="field">
                <span className="field__label">{t("feedback_message")}</span>
                <textarea required maxLength={4000} value={message} rows={5}
                          onChange={e => setMessage(e.target.value)}
                          className="field__input"
                          placeholder={t("feedback_message_ph")} />
              </label>

              <label className="field">
                <span className="field__label">{t("feedback_email_optional")}</span>
                <input type="email" value={email}
                       onChange={e => setEmail(e.target.value)}
                       className="field__input"
                       placeholder="you@example.org" />
                <span className="field__hint">{t("feedback_email_hint")}</span>
              </label>

              {err && <div className="login-err">{err}</div>}

              <button className="login-btn" type="submit" disabled={busy || !subject.trim() || !message.trim()}>
                {busy ? "…" : t("feedback_send")}
              </button>
            </form>
          )}
        </div>

        <footer className="ai-foot">
          <button className="modal__ok" onClick={onClose}>{t("close")}</button>
        </footer>
      </aside>
    </>,
    document.body
  );
}
