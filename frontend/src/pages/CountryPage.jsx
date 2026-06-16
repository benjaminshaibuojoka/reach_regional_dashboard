import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Header from "../components/Header.jsx";
import KpiRow from "../components/KpiRow.jsx";
import FilterBar from "../components/FilterBar.jsx";
import MapView from "../components/MapView.jsx";
import StatePanel from "../components/StatePanel.jsx";
import TrendPanel from "../components/TrendPanel.jsx";
import BottomNav from "../components/BottomNav.jsx";
import PanelHead from "../components/PanelHead.jsx";
import FloatingMenu from "../components/FloatingMenu.jsx";
import { api } from "../api.js";
import { useFilterUrlState } from "../hooks/useFilterUrlState.js";

const SOURCES = { NIGERIA: "src_nigeria", NIGER: "src_niger", MALI: "src_mali" };
const TITLES  = { NIGERIA: "title_nigeria", NIGER: "title_niger", MALI: "title_mali" };

// Drill-down stops at state/region per spec — no LGA layer.
const EMPTY = { year: null, quarter: null, round: null, state: null };

export default function CountryPage({ country }) {
  const { t } = useTranslation();
  const [filters, setFilters] = useState(EMPTY);
  useFilterUrlState(filters, setFilters);

  // Clear state / lga when switching countries — otherwise Bauchi (NGA)
  // would persist when navigating into Niger and confuse the dropdowns.
  useEffect(() => { setFilters(EMPTY); }, [country]);
  const [kpis, setKpis] = useState(null);
  const [byState, setByState] = useState([]);
  const [trend, setTrend] = useState([]);

  useEffect(() => {
    const params = { country, ...filters };
    api.kpis(params).then(setKpis);
    api.byState(params).then(setByState);
    api.trend(params).then(setTrend);
  }, [country, JSON.stringify(filters)]);

  // Clicking ANY state/region (on map or in a bar row) toggles the state
  // filter — clicking the same selection again returns to the default view.
  const onPolyClick = (p) => {
    if (!p?.name) return;
    const name = String(p.name).toUpperCase();
    setFilters((f) => ({ ...f, state: f.state === name ? null : name }));
  };
  // Toggle behaviour: clicking the same row again clears the state filter.
  const onBarRow = (r) => {
    if (!r?.state) return;
    const name = String(r.state).toUpperCase();
    setFilters((f) => ({ ...f, state: f.state === name ? null : name }));
  };

  return (
    <div className="app app--country">
      <Header title={t(TITLES[country])} country={country} filters={filters} />
      <FilterBar country={country} value={filters} onChange={setFilters} onReset={() => setFilters(EMPTY)} />
      <KpiRow data={kpis} scope={{ country, ...filters }} />
      <div className="content content--cols">
        <div className="left-col left-col--two" style={{gridTemplateRows: "1.4fr 1fr"}}>
          <div className="panel">
            <StatePanel
              rows={byState} country={country} selected={filters.state} onRowClick={onBarRow}
              head={({ title, right }) => (
                <PanelHead title={title} help={t("chart_eligible_vs_treated_state_help")} source={t(SOURCES[country])} right={right} />
              )}
            />
          </div>
          <div className="panel">
            <TrendPanel
              data={trend} country={country}
              head={({ right }) => (
                <PanelHead title={t("chart_trend_state")} right={right} />
              )}
            />
          </div>
        </div>
        <div className="panel">
          <PanelHead title={t("chart_treated_state")} help={t("chart_treated_state_help")} source={t(SOURCES[country])} />
          <div className="panel__body panel__body--flush">
            <MapView country={country} filters={filters} adminLevel={1} onPolygonClick={onPolyClick} />
          </div>
        </div>
      </div>
      <BottomNav source={t(SOURCES[country])} country={country} />
      <FloatingMenu scope={{ country, ...filters }} country={country} />
    </div>
  );
}
