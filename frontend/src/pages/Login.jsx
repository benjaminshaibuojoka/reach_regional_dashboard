import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api.js";
import { auth } from "../auth.js";
import TermsModal from "../components/TermsModal.jsx";

export default function Login() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);

  const lang = i18n.language?.startsWith("fr") ? "fr" : "en";
  const toggle = () => {
    const next = lang === "en" ? "fr" : "en";
    i18n.changeLanguage(next);
    localStorage.setItem("reach.lang", next);
  };

  const canSubmit = username.trim() && password && accepted && !loading;

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (!accepted) { setErr(t("login_terms_required")); return; }
    setLoading(true);
    try {
      const res = await api.login(username.trim(), password);
      auth.setSession(res.token, res.username);
      navigate("/", { replace: true });
    } catch {
      setErr(t("login_error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-split">
      {/* === Left: REACH brand panel ============================== */}
      <aside className="login-split__left">
        <div className="login-split__brand">
          <img src="/logo.jpg" alt="REACH" />
          <span>REACH</span>
        </div>
        <h1 className="login-split__title">{t("login_brand_title")}</h1>
        <p className="login-split__desc">{t("login_brand_desc")}</p>
        <div className="login-split__foot">
          © Copyright {new Date().getFullYear()}, all rights reserved.
          <span className="login-split__dot">·</span>
          <a href="https://reachnetwork.africa/" target="_blank" rel="noopener noreferrer">reachnetwork.africa</a>
          <span className="login-split__dot">·</span>
          <button type="button" className="login-split__link" onClick={() => setTermsOpen(true)}>
            {t("terms_title")}
          </button>
        </div>
      </aside>

      {/* === Right: login card ============================= */}
      <section className="login-split__right">
        <div className="login-card login-card--in-split">
          <button className="lang login-lang" onClick={toggle} type="button" aria-label="Toggle language">
            <span className={lang === "en" ? "on" : ""}>EN</span>
            <span className={lang === "fr" ? "on" : ""}>FR</span>
          </button>
          <div className="login-brand">
            <img src="/logo.jpg" alt="REACH" />
            <div>
              <div className="login-brand__name">REACH</div>
              <div className="login-brand__tag">Resiliency through Azithromycin for Children</div>
            </div>
          </div>
          <h2 className="login-title">{t("login_title")}</h2>
          <p className="login-sub">{t("login_sub")}</p>

          <form onSubmit={submit} className="login-form">
            <label className="field">
              <span className="field__label">{t("login_username")}</span>
              <input type="text" autoComplete="username" required
                     value={username} onChange={(e) => setUsername(e.target.value)}
                     className="field__input" autoFocus />
            </label>
            <label className="field">
              <span className="field__label">{t("login_password")}</span>
              <input type="password" autoComplete="current-password" required
                     value={password} onChange={(e) => setPassword(e.target.value)}
                     className="field__input" />
            </label>

            <label className="terms-check">
              <input type="checkbox" checked={accepted}
                     onChange={(e) => setAccepted(e.target.checked)} />
              <span className="terms-check__box" aria-hidden="true" />
              <span className="terms-check__text">
                {t("login_terms_pre")}{" "}
                <button type="button" className="terms-check__link"
                        onClick={() => setTermsOpen(true)}>
                  {t("login_terms_link")}
                </button>
                {t("login_terms_post")}
              </span>
            </label>

            {err && <div className="login-err">{err}</div>}

            <button className="login-btn" type="submit" disabled={!canSubmit}>
              {loading ? "..." : t("login_submit")}
            </button>
            <div className="login-hint">{t("login_hint")}</div>
          </form>
        </div>
      </section>

      <TermsModal open={termsOpen}
                  onClose={() => setTermsOpen(false)}
                  onAccept={() => setAccepted(true)} />
    </div>
  );
}
