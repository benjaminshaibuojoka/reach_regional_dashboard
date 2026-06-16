import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";

/**
 * Two-way binding between a filters object and the URL search params.
 * - On mount: hydrate filters from ?year=2025&round=3&...
 * - When filters change: replace the URL so refresh / share preserves state.
 *
 * Unknown keys in URL are ignored; null/empty values are stripped from URL.
 */
export function useFilterUrlState(filters, setFilters, keys = ["year", "quarter", "round", "state", "lga"]) {
  const navigate = useNavigate();
  const location = useLocation();
  const hydrated = useRef(false);

  // Hydrate once on mount
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    const sp = new URLSearchParams(location.search);
    const patch = {};
    for (const k of keys) {
      const v = sp.get(k);
      if (v != null && v !== "") patch[k] = v;
    }
    if (Object.keys(patch).length) {
      setFilters((f) => ({ ...f, ...patch }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mirror filter state back to URL
  useEffect(() => {
    if (!hydrated.current) return;
    const sp = new URLSearchParams(location.search);
    keys.forEach((k) => sp.delete(k));
    keys.forEach((k) => {
      const v = filters[k];
      if (v != null && v !== "") sp.set(k, String(v));
    });
    const q = sp.toString();
    const newUrl = q ? `${location.pathname}?${q}` : location.pathname;
    if (newUrl !== `${location.pathname}${location.search}`) {
      navigate(newUrl, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filters)]);
}
