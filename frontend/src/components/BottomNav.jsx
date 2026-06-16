import React from "react";
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { IconHome, IconGlobe } from "./Icons.jsx";
import { FlagNG, FlagNE, FlagML } from "./Flags.jsx";
import SourceLine from "./SourceLine.jsx";

export default function BottomNav({ source, country }) {
  const { t } = useTranslation();
  const cls = ({ isActive }) => (isActive ? "active" : "");
  return (
    <nav className="bottom-nav">
      <span className="bottom-nav__source">
        <SourceLine country={country && country !== "REGIONAL" ? country : null} />
      </span>
      <div className="bottom-nav__items">
        <NavLink to="/"          className={cls} end><span className="pill"><IconHome size={13} /></span>{t("home")}</NavLink>
        <NavLink to="/regional"  className={cls}><span className="pill"><IconGlobe size={13} /></span>{t("regional")}</NavLink>
        <NavLink to="/nigeria"   className={cls}><FlagNG />{t("nigeria")}</NavLink>
        <NavLink to="/niger"     className={cls}><FlagNE />{t("niger")}</NavLink>
        <NavLink to="/mali"      className={cls}><FlagML />{t("mali")}</NavLink>
      </div>
    </nav>
  );
}
