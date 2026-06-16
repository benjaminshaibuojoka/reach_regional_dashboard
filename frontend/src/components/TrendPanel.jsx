import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import TrendLine from "./TrendLine.jsx";

/**
 * Wrapper that owns the trend/forecast mode state. The toggle is exposed
 * through the `head` render-prop so it can live in PanelHead's right slot
 * (alongside the title), never floating over the chart itself.
 */
export default function TrendPanel({ data = [], country, head }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState("trend");
  return (
    <>
      {head({
        right: (
          <div className="trend-toggle trend-toggle--in-head">
            <button className={`trend-toggle__btn ${mode === "trend"    ? "trend-toggle__btn--on" : ""}`}
                    onClick={() => setMode("trend")}>{t("toggle_trend")}</button>
            <button className={`trend-toggle__btn ${mode === "forecast" ? "trend-toggle__btn--on" : ""}`}
                    onClick={() => setMode("forecast")}>{t("toggle_forecast")}</button>
          </div>
        ),
      })}
      <div className="panel__body">
        <TrendLine data={data} country={country} mode={mode} />
      </div>
    </>
  );
}
