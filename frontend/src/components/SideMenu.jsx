import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { IconGlobe } from "./Icons.jsx";
import { FlagNG, FlagNE, FlagML } from "./Flags.jsx";
import { api } from "../api.js";

const COUNTRIES = [
  { key: "NIGERIA", to: "/nigeria", flag: FlagNG, labelKey: "nigeria" },
  { key: "NIGER",   to: "/niger",   flag: FlagNE, labelKey: "niger" },
  { key: "MALI",    to: "/mali",    flag: FlagML, labelKey: "mali" },
];

const compact = (n) => {
  const v = Number(n || 0);
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return v.toLocaleString();
};

const Chevron = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 6 15 12 9 18" />
  </svg>
);

function coverageHue(pct) {
  if (pct == null) return "#9ca3af";
  if (pct >= 95) return "#16a34a";
  if (pct >= 85) return "#65a30d";
  if (pct >= 70) return "#ca8a04";
  return "#dc2626";
}

export default function SideMenu() {
  const { t } = useTranslation();
  const [stats, setStats] = useState({});

  useEffect(() => {
    api.byCountry({}).then((rows) => {
      const map = {};
      (rows || []).forEach(r => { map[r.country] = r; });
      setStats(map);
    }).catch(() => {});
  }, []);

  return (
    <aside className="side-menu" aria-label={t("menu")}>
      <div className="side-menu__head">
        <span className="side-menu__title">{t("menu")}</span>
        <span className="side-menu__hint">{t("menu_quick_nav")}</span>
      </div>

      <Link to="/regional" className="menu-tile menu-tile--feature">
        <span className="menu-tile__icon"><IconGlobe size={18} /></span>
        <div className="menu-tile__body">
          <div className="menu-tile__title">{t("regional_view")}</div>
          <div className="menu-tile__sub">{t("menu_all_combined")}</div>
        </div>
        <span className="menu-tile__chev"><Chevron /></span>
      </Link>

      <div className="menu-divider"><span>{t("menu_countries")}</span></div>

      {COUNTRIES.map(({ key, to, flag: Flag, labelKey }) => {
        const s = stats[key];
        const pct = s?.percentage;
        return (
          <Link key={key} to={to} className="menu-tile menu-tile--country">
            <span className="menu-tile__flag"><Flag size={22} /></span>
            <div className="menu-tile__body">
              <div className="menu-tile__title">{t(labelKey)}</div>
              <div className="menu-tile__sub">
                {s ? (
                  <>
                    <span className="menu-tile__pct" style={{ color: coverageHue(pct) }}>
                      {Math.round(pct)}%
                    </span>
                    <span className="menu-tile__dot">·</span>
                    <span>{compact(s.treated)} {t("menu_treated")}</span>
                  </>
                ) : <>&nbsp;</>}
              </div>
            </div>
            <span className="menu-tile__chev"><Chevron /></span>
          </Link>
        );
      })}
    </aside>
  );
}
