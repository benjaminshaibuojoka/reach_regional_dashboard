import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header.jsx";
import KpiRow from "../components/KpiRow.jsx";
import FilterBar from "../components/FilterBar.jsx";
import MapView from "../components/MapView.jsx";
import HorizontalBars from "../components/HorizontalBars.jsx";
import PercentageBars from "../components/PercentageBars.jsx";
import TrendPanel from "../components/TrendPanel.jsx";
import BottomNav from "../components/BottomNav.jsx";
import PanelHead from "../components/PanelHead.jsx";
import FloatingMenu from "../components/FloatingMenu.jsx";
import { api } from "../api.js";
import { useFilterUrlState } from "../hooks/useFilterUrlState.js";

const COUNTRY_ROUTE = { NIGERIA: "/nigeria", NIGER: "/niger", MALI: "/mali" };
const EMPTY = { year: null, quarter: null, round: null };

export default function Regional() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [filters, setFilters] = useState(EMPTY);
  useFilterUrlState(filters, setFilters);
  const [kpis, setKpis] = useState(null);
  const [byCountry, setByCountry] = useState([]);
  const [trend, setTrend] = useState([]);

  useEffect(() => {
    const params = { ...filters };
    api.kpis(params).then(setKpis);
    api.byCountry(params).then(setByCountry);
    api.trend(params).then(setTrend);
  }, [JSON.stringify(filters)]);

  const onPolyClick = (p) => {
    if (p?.country && COUNTRY_ROUTE[p.country]) navigate(COUNTRY_ROUTE[p.country]);
  };
  const onCountryRow = (r) => {
    const c = (r?.country || "").toUpperCase();
    if (COUNTRY_ROUTE[c]) navigate(COUNTRY_ROUTE[c]);
  };

  return (
    <div className="app app--country">
      <Header title={t("title_regional")} country={null} filters={filters} />
      <FilterBar country={null} value={filters} onChange={setFilters} onReset={() => setFilters(EMPTY)} />
      <KpiRow data={kpis} scope={filters} />
      <div className="content content--cols">
        <div className="left-col">
          <div className="panel">
            <PanelHead title={t("chart_eligible_vs_treated_country")} help={t("chart_eligible_vs_treated_country_help")} source={t("src_regional")} />
            <div className="panel__body"><HorizontalBars rows={byCountry} labelKey="country" onRowClick={onCountryRow} /></div>
          </div>
          <div className="split-2">
            <div className="panel">
              <PanelHead title={t("chart_pct_country")} help={t("chart_pct_country_help")} source={t("src_regional")} />
              <div className="panel__body"><PercentageBars rows={byCountry} labelKey="country" onRowClick={onCountryRow} /></div>
            </div>
            <div className="panel">
              <TrendPanel
                data={trend} country={null}
                head={({ right }) => (
                  <PanelHead title={t("chart_treated_over_time")} right={right} />
                )}
              />
            </div>
          </div>
        </div>
        <div className="panel">
          <PanelHead title={t("chart_treated_country")} help={t("chart_treated_country_help")} source={t("src_regional")} />
          <div className="panel__body panel__body--flush">
            <MapView country="REGIONAL" filters={filters} adminLevel={1} onPolygonClick={onPolyClick} />
          </div>
        </div>
      </div>
      <BottomNav country="REGIONAL" />
      <FloatingMenu scope={filters} country={null} />
    </div>
  );
}
