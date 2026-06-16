import React from "react";

const base = {
  width: 18, height: 18, viewBox: "0 0 24 24", fill: "none",
  stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round",
};

const make = (paths) => function Icon({ size = 18, stroke = "currentColor", strokeWidth = 1.8, ...rest }) {
  return (
    <svg {...base} width={size} height={size} stroke={stroke} strokeWidth={strokeWidth} {...rest}>
      {paths}
    </svg>
  );
};

export const IconEye        = make(<><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>);
export const IconSyringe    = make(<><path d="m18 2 4 4" /><path d="m15 5 6 6" /><path d="m12 8 8 8" /><path d="m4 22 4-4" /><path d="m4.5 16.5 3 3" /><path d="m9 11 6 6-3 3-6-6Z" /></>);
export const IconPercent    = make(<><line x1="19" y1="5" x2="5" y2="19" /><circle cx="6.5" cy="6.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" /></>);
export const IconAlert      = make(<><circle cx="12" cy="12" r="9" /><line x1="12" y1="8" x2="12" y2="13" /><line x1="12" y1="16.5" x2="12" y2="16.5" /></>);
export const IconHeart      = make(<><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z" /></>);
export const IconDownload   = make(<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></>);
export const IconChevronDown= make(<polyline points="6 9 12 15 18 9" />);
export const IconMenu       = make(<><line x1="3" y1="6"  x2="21" y2="6"  /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>);
export const IconHome       = make(<><path d="M3 11 12 3l9 8" /><path d="M5 10v10h14V10" /></>);
export const IconGlobe      = make(<><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3a13 13 0 0 1 0 18a13 13 0 0 1 0-18Z" /></>);
export const IconMapPin     = make(<><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></>);
export const IconCalendar   = make(<><rect x="3" y="4" width="18" height="17" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="16" y1="2" x2="16" y2="6" /></>);
export const IconFilter     = make(<polygon points="3 4 21 4 14 13 14 20 10 22 10 13 3 4" />);
export const IconLanguages  = make(<><path d="M3 5h12" /><path d="M9 3v2c0 6-4 9-6 9" /><path d="M5 9c0 5 4 8 8 9" /><path d="m14 21 4-9 4 9" /><path d="M16 17h4" /></>);
