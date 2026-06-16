import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import HorizontalBars from "./HorizontalBars.jsx";
import StateRetentionBars from "./StateRetentionBars.jsx";

export default function StatePanel({ rows, country, selected, onRowClick, head }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState("bars");
  const titles = {
    bars: t("chart_eligible_vs_treated_state"),
    retention: t("ana_growth_title"),     // Retention rebranded as Growth
  };
  return (
    <>
      {head({
        title: titles[mode],
        right: (
          <div className="trend-toggle trend-toggle--in-head">
            <button className={`trend-toggle__btn ${mode === "bars" ? "trend-toggle__btn--on" : ""}`}
                    onClick={() => setMode("bars")}>{t("toggle_bars")}</button>
            <button className={`trend-toggle__btn ${mode === "retention" ? "trend-toggle__btn--on" : ""}`}
                    onClick={() => setMode("retention")}>{t("toggle_growth")}</button>
          </div>
        ),
      })}
      <div className="panel__body">
        {mode === "bars"
          ? <HorizontalBars rows={rows} labelKey="state" onRowClick={onRowClick} selected={selected} />
          : <StateRetentionBars country={country} />}
      </div>
    </>
  );
}
