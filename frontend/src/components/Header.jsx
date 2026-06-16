import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { IconDownload } from "./Icons.jsx";
import DownloadMenu from "./DownloadMenu.jsx";
import { auth } from "../auth.js";
import { apiFetch, apiRoot } from "../http.js";

export default function Header({ title, country, filters = {} }) {
  const { i18n, t } = useTranslation();
  const navigate = useNavigate();
  const lang = i18n.language?.startsWith("fr") ? "fr" : "en";
  const [openDl, setOpenDl] = useState(false);
  const [lastValidated, setLastValidated] = useState(null);
  const dlRef = useRef(null);
  const dlBtnRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const u = new URLSearchParams();
    if (country) u.set("country", country);
    apiFetch(`${apiRoot}/source-metadata${u.toString() ? "?" + u : ""}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!cancelled) setLastValidated(d?.last_validated || null); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [country]);

  useEffect(() => {
    const onDoc = (e) => {
      // The DownloadMenu is rendered via createPortal to document.body, so
      // it lives OUTSIDE dlRef. Treat any click landing inside `.dl-pop`
      // as "inside" — otherwise mousedown closes the menu before the
      // anchor's click event can fire and the file never downloads.
      if (dlRef.current && !dlRef.current.contains(e.target) && !e.target.closest?.(".dl-pop")) {
        setOpenDl(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const toggle = () => {
    const next = lang === "en" ? "fr" : "en";
    i18n.changeLanguage(next);
    localStorage.setItem("reach.lang", next);
  };
  const logout = () => { auth.clear(); navigate("/login", { replace: true }); };

  return (
    <header className="header">
      <div className="header__brand">
        <img src="/logo.jpg" alt="REACH" className="brand-img" />
        <div className="brand-meta">
          <div className="brand-text">REACH</div>
        </div>
      </div>

      <div className="header__center">
        <h1 className="header__title">{title}</h1>
        {lastValidated && (
          <span className="last-updated" title={t("last_updated") + ": " + lastValidated}>
            <span className="last-updated__dot" aria-hidden="true" />
            {t("last_updated")}: {lastValidated}
          </span>
        )}
      </div>

      <div className="header__right">
        <div className="relative" ref={dlRef}>
          <button
            ref={dlBtnRef}
            className="icon-btn"
            title={t("download")}
            aria-haspopup="true"
            aria-expanded={openDl}
            onClick={() => setOpenDl((v) => !v)}
          >
            <IconDownload size={16} />
          </button>
          {openDl && (
            <DownloadMenu country={country} filters={filters} anchorRef={dlBtnRef} onClose={() => setOpenDl(false)} />
          )}
        </div>

        <button className="lang" onClick={toggle} role="switch" aria-checked={lang === "fr"} aria-label="Toggle language">
          <span className={lang === "en" ? "on" : ""}>EN</span>
          <span className={lang === "fr" ? "on" : ""}>FR</span>
        </button>

        {auth.getUser() && (
          <button className="signout-link" onClick={logout}>{t("sign_out")}</button>
        )}
      </div>
    </header>
  );
}
