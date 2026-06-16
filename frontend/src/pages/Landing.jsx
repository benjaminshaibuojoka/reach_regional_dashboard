import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Header from "../components/Header.jsx";
import KpiRow from "../components/KpiRow.jsx";
import MapView from "../components/MapView.jsx";
import PanelHead from "../components/PanelHead.jsx";
import SideMenu from "../components/SideMenu.jsx";
import FloatingMenu from "../components/FloatingMenu.jsx";
import CountryHighlights from "../components/CountryHighlights.jsx";
import { api } from "../api.js";
import { useNavigate } from "react-router-dom";

const COUNTRY_ROUTE = { NIGERIA: "/nigeria", NIGER: "/niger", MALI: "/mali" };

export default function Landing() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [kpis, setKpis] = useState(null);

  useEffect(() => {
    api.kpis({}).then(setKpis).catch(() => setKpis({}));
  }, []);

  const onPolyClick = (p) => {
    if (p?.country && COUNTRY_ROUTE[p.country]) navigate(COUNTRY_ROUTE[p.country]);
  };

  return (
    <div className="app app--landing">
      <Header title={t("title_regional")} country={null} filters={{}} />

      <div className="banner">
        <span className="banner__label">{t("background")}</span>
        <span className="banner__text">{t("background_text")}</span>
      </div>

      <KpiRow data={kpis} scope={{}} />

      <div className="content content--landing">
        <div className="panel panel--glass">
          <PanelHead title={t("chart_treated_country")} help={t("chart_treated_country_help")} source={t("src_regional")} />
          <div className="panel__body panel__body--flush">
            <MapView
              country="REGIONAL" filters={{}} adminLevel={1}
              onPolygonClick={onPolyClick}
              showViewToggle={false}
              maxZoomOverride={13.5}
              labelMode="home"
              countryLabelCutoff={5.5}
            />
          </div>
        </div>

        <div className="panel panel--glass panel--momentum">
          <CountryHighlights layout="vertical" />
        </div>

        <SideMenu />
      </div>
      <FloatingMenu scope={{}} country={null} />
    </div>
  );
}
