import React, { useEffect, useState } from "react";
import { apiFetch, apiRoot as root } from "../http.js";

export default function SourceLine({ country }) {
  const [meta, setMeta] = useState(null);
  useEffect(() => {
    const u = new URLSearchParams();
    if (country) u.set("country", country);
    apiFetch(`${root}/source-metadata${u.toString() ? "?" + u : ""}`)
      .then(r => r.json()).then(setMeta).catch(() => setMeta(null));
  }, [country]);

  if (!meta) return null;
  return (
    <span className="source-line" title={`${meta.coverage_period} · ${meta.license}`}>
      Data Source: <span className="source-line__src">{meta.source}</span>
    </span>
  );
}
