import React from "react";

export const FlagNG = ({ size = 22 }) => (
  <svg className="flag" width={size} height={size} viewBox="0 0 24 24">
    <rect width="8" height="24" x="0"  fill="#008751"/>
    <rect width="8" height="24" x="8"  fill="#ffffff"/>
    <rect width="8" height="24" x="16" fill="#008751"/>
  </svg>
);

export const FlagNE = ({ size = 22 }) => (
  <svg className="flag" width={size} height={size} viewBox="0 0 24 24">
    <rect width="24" height="8" y="0"  fill="#e05206"/>
    <rect width="24" height="8" y="8"  fill="#ffffff"/>
    <rect width="24" height="8" y="16" fill="#0db02b"/>
    <circle cx="12" cy="12" r="2.4" fill="#e05206"/>
  </svg>
);

export const FlagML = ({ size = 22 }) => (
  <svg className="flag" width={size} height={size} viewBox="0 0 24 24">
    <rect width="8" height="24" x="0"  fill="#14b53a"/>
    <rect width="8" height="24" x="8"  fill="#fcd116"/>
    <rect width="8" height="24" x="16" fill="#ce1126"/>
  </svg>
);

export const FlagFor = (country) => {
  if (country === "NIGERIA") return FlagNG;
  if (country === "NIGER")   return FlagNE;
  if (country === "MALI")    return FlagML;
  return null;
};
