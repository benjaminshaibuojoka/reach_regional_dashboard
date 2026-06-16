import React from "react";

export default function InfoTip({ text, size = 14 }) {
  if (!text) return null;
  return (
    <span className="info-tip" tabIndex={0} aria-label={text} data-tip={text}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12" y2="8" />
      </svg>
    </span>
  );
}
