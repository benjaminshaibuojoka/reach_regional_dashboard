import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import AIAssistant from "./AIAssistant.jsx";
import Subscriptions from "./Subscriptions.jsx";
import FeedbackModal from "./FeedbackModal.jsx";

const ChatIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 11.5a8.38 8.38 0 0 1-3.8 7l.8 4-4.3-1.5A8.38 8.38 0 0 1 3 11.5 8.5 8.5 0 0 1 11.5 3 8.5 8.5 0 0 1 21 11.5Z"/>
  </svg>
);
const AIIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v3" /><path d="M12 18v3" /><path d="M3 12h3" /><path d="M18 12h3" />
    <path d="M5.6 5.6l2.1 2.1" /><path d="M16.3 16.3l2.1 2.1" />
    <path d="M5.6 18.4l2.1-2.1" /><path d="M16.3 7.7l2.1-2.1" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const BellIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.7 21a2 2 0 0 1-3.4 0" />
  </svg>
);
const FeedbackIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 9V5a3 3 0 0 0-6 0v4" />
    <rect x="5" y="9" width="14" height="11" rx="2" />
    <path d="M9 14h6M9 18h4" />
  </svg>
);

export default function FloatingMenu({ scope = {}, country }) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [subsOpen, setSubsOpen] = useState(false);
  const [fbOpen, setFbOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <>
      <div className="float-launcher" ref={ref}>
        <button
          className="float-fab"
          onClick={() => setMenuOpen((v) => !v)}
          aria-haspopup="true" aria-expanded={menuOpen}
          aria-label={t("float_open")}
          title={t("float_open")}
        >
          <ChatIcon size={20} />
          <span className="float-fab__pulse" />
        </button>
        {menuOpen && (
          <div className="float-menu" role="menu">
            <button className="float-menu__item"
                    onClick={() => { setMenuOpen(false); setAiOpen(true); }}>
              <span className="float-menu__icon"><AIIcon /></span>
              <span className="float-menu__body">
                <span className="float-menu__title">{t("float_ai")}</span>
                <span className="float-menu__sub">{t("float_ai_sub")}</span>
              </span>
            </button>
            <button className="float-menu__item"
                    onClick={() => { setMenuOpen(false); setSubsOpen(true); }}>
              <span className="float-menu__icon"><BellIcon /></span>
              <span className="float-menu__body">
                <span className="float-menu__title">{t("float_alerts")}</span>
                <span className="float-menu__sub">{t("float_alerts_sub")}</span>
              </span>
            </button>
            <button className="float-menu__item"
                    onClick={() => { setMenuOpen(false); setFbOpen(true); }}>
              <span className="float-menu__icon"><FeedbackIcon /></span>
              <span className="float-menu__body">
                <span className="float-menu__title">{t("float_feedback")}</span>
                <span className="float-menu__sub">{t("float_feedback_sub")}</span>
              </span>
            </button>
          </div>
        )}
      </div>

      {aiOpen   && <AIAssistant   scope={scope}                       forceOpen onClose={() => setAiOpen(false)} />}
      {subsOpen && <Subscriptions defaultScope={country || "REGIONAL"} onClose={() => setSubsOpen(false)} />}
      {fbOpen   && <FeedbackModal open                                 onClose={() => setFbOpen(false)} />}
    </>
  );
}
