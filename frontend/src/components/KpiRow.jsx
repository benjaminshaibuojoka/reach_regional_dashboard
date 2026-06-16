import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import KpiCard from "./KpiCard.jsx";
import { IconEye, IconSyringe, IconPercent, IconAlert, IconHeart } from "./Icons.jsx";
import { apiFetch, apiRoot as root, qs } from "../http.js";

const fmt = (n) => (n == null ? "—" : Number(n).toLocaleString());

function narrative(scopeLabel, label, current, previous, currentQ, previousQ, isPct = false, invert = false) {
  if (current == null) return null;
  if (previous == null) {
    return `${label} for ${scopeLabel} is ${isPct ? `${current}%` : fmt(current)} in ${currentQ || "the current period"}.`;
  }
  const diff = current - previous;
  if (diff === 0) return `${label} for ${scopeLabel} is unchanged from ${previousQ}.`;
  const dir = diff > 0 ? (invert ? "rose" : "rose") : (invert ? "fell" : "fell");
  const word = invert ? (diff > 0 ? "rose" : "fell") : (diff > 0 ? "rose" : "fell");
  const change = isPct
    ? `${Math.abs(Math.round(diff))} pts`
    : `${Math.abs(Math.round((diff / (previous || 1)) * 100))}%`;
  return `${label} for ${scopeLabel} is ${isPct ? `${current}%` : fmt(current)} in ${currentQ}, ${word} ${change} versus ${previousQ} (${isPct ? `${previous}%` : fmt(previous)}).`;
}

export default function KpiRow({ data, scope = {} }) {
  const { t } = useTranslation();
  const d = data || {};
  const [deltas, setDeltas] = useState({});

  useEffect(() => {
    let cancelled = false;
    const params = { country: scope.country, state: scope.state, lga: scope.lga };
    apiFetch(`${root}/kpi-deltas${qs(params)}`).then(r => r.json()).then(x => { if (!cancelled) setDeltas(x || {}); }).catch(() => {});
    return () => { cancelled = true; };
  }, [scope.country, scope.state, scope.lga]);

  const scopeLabel = (scope.lga || scope.state || scope.country || "all countries").toString().toLowerCase()
                       .replace(/\b\w/g, c => c.toUpperCase());
  const qCur = deltas?.quarter, qPrev = deltas?.previous_quarter;

  return (
    <div className="kpi-strip">
      <KpiCard icon={IconEye} value={fmt(d.children_eligible)} label={t("kpi_eligible")} help={t("kpi_eligible_help")} indicator="children_eligible"
        deltaPct={deltas?.eligible?.delta_pct}
        insight={narrative(scopeLabel, "Children Eligible", deltas?.eligible?.current, deltas?.eligible?.previous, qCur, qPrev)} />
      <KpiCard icon={IconSyringe} value={fmt(d.children_treated)} label={t("kpi_treated")} help={t("kpi_treated_help")} indicator="children_treated"
        deltaPct={deltas?.treated?.delta_pct}
        insight={narrative(scopeLabel, "Children Treated", deltas?.treated?.current, deltas?.treated?.previous, qCur, qPrev)} />
      <KpiCard icon={IconPercent} value={`${d.percentage_treated ?? 0}%`} label={t("kpi_percentage")} help={t("kpi_percentage_help")} indicator="percentage_treated"
        deltaPct={deltas?.percentage?.delta_pct}
        insight={narrative(scopeLabel, "Percentage Treated", deltas?.percentage?.current, deltas?.percentage?.previous, qCur, qPrev, true)} />
      <KpiCard icon={IconAlert} value={fmt(d.severe_adverse_event)} label={t("kpi_sae")} help={t("kpi_sae_help")} indicator="severe_adverse_event"
        deltaPct={deltas?.sae?.delta_pct} invertDelta
        insight={narrative(scopeLabel, "Severe Adverse Effects", deltas?.sae?.current, deltas?.sae?.previous, qCur, qPrev, false, true)} />
      <KpiCard icon={IconHeart} value={fmt(d.deaths_averted)} label={t("kpi_deaths_averted")} help={t("kpi_deaths_averted_help")} indicator="deaths_averted"
        approximate
        deltaPct={deltas?.deaths?.delta_pct}
        insight={narrative(scopeLabel, "Estimated Deaths Averted", deltas?.deaths?.current, deltas?.deaths?.previous, qCur, qPrev)} />
    </div>
  );
}
