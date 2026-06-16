import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api.js";
import { IconCalendar, IconFilter, IconMapPin } from "./Icons.jsx";

const IconReset = (props) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <polyline points="1 4 1 10 7 10" />
    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
  </svg>
);

export default function FilterBar({ country, value, onChange, onReset }) {
  const { t } = useTranslation();
  const [opts, setOpts] = useState({ years: [], quarters: [], rounds: [], states: [], lgas: [] });
  const [loading, setLoading] = useState(false);

  // Cascade: pass every active filter so the API trims options to valid
  // combinations only. Re-fetch whenever ANY filter or the country changes.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.filters({ country, state: value.state, year: value.year, quarter: value.quarter, round: value.round })
      .then((d) => { if (!cancelled) setOpts(d); })
      .catch(() => { if (!cancelled) setOpts({ years: [], quarters: [], rounds: [], states: [], lgas: [] }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [country, value.state, value.year, value.quarter, value.round]);

  // Auto-clear selections that are no longer valid (e.g. you picked Round=4
  // under Year=2025, then switched to Year=2024 where Round 4 doesn't exist).
  useEffect(() => {
    const patch = {};
    if (value.year     != null && opts.years.length    && !opts.years.includes(Number(value.year)))         patch.year = null;
    if (value.quarter  != null && opts.quarters.length && !opts.quarters.includes(value.quarter))           patch.quarter = null;
    if (value.round    != null && opts.rounds.length   && !opts.rounds.includes(Number(value.round)))       patch.round = null;
    if (value.state    != null && opts.states.length   && !opts.states.includes(String(value.state).toUpperCase())) patch.state = null;
    if (Object.keys(patch).length) onChange({ ...value, ...patch });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts]);

  const Field = ({ icon: Icon, label, field, items }) => (
    <div className="filter">
      <Icon className="filter__icon" size={14} />
      <div className="filter__wrap">
        <span className="filter__label">{label}</span>
        <select
          className="filter__select"
          value={value[field] ?? ""}
          onChange={(e) => onChange({ ...value, [field]: e.target.value || null })}
        >
          <option value="">{t("filter_all")}</option>
          {items.map((x) => (<option key={x} value={x}>{x}</option>))}
        </select>
      </div>
    </div>
  );

  const active = Object.entries(value).filter(([, v]) => v !== null && v !== "" && v !== undefined);
  const labels = {
    quarter: t("filter_quarter"), year: t("filter_year"), round: t("filter_rounds"),
    state: t("filter_state"),
  };
  const hasActive = active.length > 0;

  return (
    <div className={`filters-wrap ${loading ? "filters-wrap--loading" : ""}`}>
      <div className="filters">
        <Field icon={IconCalendar} label={t("filter_quarter")} field="quarter" items={opts.quarters} />
        <Field icon={IconCalendar} label={t("filter_year")}    field="year"    items={opts.years} />
        <Field icon={IconFilter}   label={t("filter_rounds")}  field="round"   items={opts.rounds} />
        {country && <Field icon={IconMapPin} label={t("filter_state")} field="state" items={opts.states} />}
        <button
          type="button"
          className="filter-reset filter-reset--sticky"
          onClick={onReset}
          title={t("filter_reset")}
          aria-label={t("filter_reset")}
        >
          <IconReset />
          <span>{t("filter_reset")}</span>
        </button>
      </div>
      {hasActive && (
        <div className="chips">
          <span className="chips__label">{t("active_filters")}</span>
          {active.map(([k, v]) => (
            <button key={k} className="chip" onClick={() => onChange({ ...value, [k]: null })}>
              <span className="chip__k">{labels[k] || k}:</span>
              <span className="chip__v">{v}</span>
              <span className="chip__x" aria-hidden>×</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
