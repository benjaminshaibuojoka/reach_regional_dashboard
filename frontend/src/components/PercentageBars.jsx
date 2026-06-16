import React from "react";
import { useTranslation } from "react-i18next";

const fmt = (n) => Number(n || 0).toLocaleString();

export default function PercentageBars({ rows = [], labelKey = "country", onRowClick, target = 80 }) {
  const { t } = useTranslation();
  const clickable = !!onRowClick;
  const overTarget = rows.filter(r => Number(r.percentage) > 100);
  return (
    <div className="pcts">
      {overTarget.length > 0 && (
        <div className="over-100-note" role="note">
          <span className="over-100-note__icon" aria-hidden="true">!</span>
          <span>
            {t("coverage_over_100_note", {
              count: overTarget.length,
              defaultValue: "{{count}} area(s) report coverage above 100%. This typically signals a microplan denominator under-estimate; values are shown as reported (not capped) for verification."
            })}
          </span>
        </div>
      )}
      {/* WHO target reference label */}
      <div className="pcts__target" aria-hidden="true">
        <span className="pcts__target-line" style={{ left: `calc(70px + 10px + ${target}% * (100% - 70px - 10px) / 100%)` }} />
      </div>
      {rows.map((r) => {
        const name = r[labelKey];
        const native = `${name}\n${t("kpi_percentage")}: ${r.percentage}%\n${t("legend_treated")}: ${fmt(r.treated)}\n${t("legend_eligible")}: ${fmt(r.eligible)}`;
        return (
          <div
            key={name}
            className={`pct ${clickable ? "pct--click" : ""}`}
            onClick={clickable ? () => onRowClick(r) : undefined}
            role={clickable ? "button" : undefined}
            tabIndex={clickable ? 0 : undefined}
            onKeyDown={clickable ? (e) => { if (e.key === "Enter" || e.key === " ") onRowClick(r); } : undefined}
            title={native}
          >
            <div className="hbar__label" title={name}>{name}</div>
            <div className="pct__track">
              {/* WHO target gridline */}
              <div className="pct__target-rule" style={{ left: `${target}%` }} />
              <div className="pct__fill" style={{ width: `${Math.min(100, r.percentage)}%` }}>
                {r.percentage}%
              </div>
            </div>
          </div>
        );
      })}
      <div className="pcts__legend">
        <span className="pcts__legend-mark" />
        WHO target ≥ {target}%
      </div>
    </div>
  );
}
