import React from "react";
import { useTranslation } from "react-i18next";

export default function LegendBar() {
  const { t } = useTranslation();
  return (
    <span className="legend-inline-bar" aria-label={t("percentage_treated_legend")}>
      <span className="legend-inline-bar__label">{t("percentage_treated_legend")}</span>
      <span className="legend-inline-bar__bar" />
      <span className="legend-inline-bar__ticks">
        <span>0</span><span>50</span><span>100+</span>
      </span>
    </span>
  );
}
