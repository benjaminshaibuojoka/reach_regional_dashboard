import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslation, Trans } from "react-i18next";

export default function TermsModal({ open, onClose, onAccept }) {
  const { t } = useTranslation();

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <>
      <div className="modal-backdrop modal-backdrop--solid" onClick={onClose} />
      <aside className="ai-drawer terms-modal" role="dialog" aria-modal
             style={{ backgroundColor: "#ffffff" }}>
        <div className="ai-drawer__bg" aria-hidden="true" style={{
          position: "absolute", inset: 0, width: "100%", height: "100%",
          backgroundColor: "#ffffff", zIndex: 0, pointerEvents: "none",
        }} />

        <header className="chatbot-head">
          <div>
            <div className="chatbot-title">{t("terms_title")}</div>
            <div className="chatbot-sub">{t("terms_subtitle")}</div>
          </div>
          <button className="chatbot-close" onClick={onClose} aria-label={t("close")}>×</button>
        </header>

        <div className="subs-body terms-body">
          <p className="terms-meta">{t("terms_last_updated")}</p>

          <Section title={t("terms_h_acceptance")}     body={t("terms_p_acceptance")} />
          <Section title={t("terms_h_authorized")}     body={t("terms_p_authorized")} />
          <Section title={t("terms_h_confidentiality")} body={t("terms_p_confidentiality")} bullets={[
            t("terms_l_confidentiality_1"),
            t("terms_l_confidentiality_2"),
            t("terms_l_confidentiality_3"),
            t("terms_l_confidentiality_4"),
          ]} />
          <Section title={t("terms_h_acceptable")}     body={t("terms_p_acceptable")} bullets={[
            t("terms_l_acceptable_1"),
            t("terms_l_acceptable_2"),
            t("terms_l_acceptable_3"),
            t("terms_l_acceptable_4"),
          ]} />
          <Section title={t("terms_h_accuracy")}       body={t("terms_p_accuracy")} bullets={[
            t("terms_l_accuracy_1"),
            t("terms_l_accuracy_2"),
            t("terms_l_accuracy_3"),
          ]} />
          <Section title={t("terms_h_privacy")}        body={t("terms_p_privacy")} />
          <Section title={t("terms_h_ip")}             body={t("terms_p_ip")} />
          <Section title={t("terms_h_disclaimer")}     body={t("terms_p_disclaimer")} />
          <Section title={t("terms_h_modifications")}  body={t("terms_p_modifications")} />
          <Section title={t("terms_h_contact")}        body={t("terms_p_contact")} />
        </div>

        <footer className="ai-foot terms-foot">
          <button className="login-btn login-btn--ghost" onClick={onClose}>{t("terms_decline")}</button>
          <button className="login-btn" onClick={() => { onAccept?.(); onClose?.(); }}>{t("terms_accept")}</button>
        </footer>
      </aside>
    </>,
    document.body
  );
}

function Section({ title, body, bullets }) {
  return (
    <section className="terms-section">
      <h3 className="terms-section__h">{title}</h3>
      {body && <p className="terms-section__p">{body}</p>}
      {bullets?.length > 0 && (
        <ul className="terms-section__ul">
          {bullets.map((b, i) => (<li key={i}>{b}</li>))}
        </ul>
      )}
    </section>
  );
}
