import React, { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, Pane, ZoomControl, useMap } from "react-leaflet";
import L from "leaflet";
import { useTranslation } from "react-i18next";
import { api } from "../api.js";
import { useHover } from "../context/HoverContext.jsx";

/* ----- colour scales ------------------------------------------------ */
function colorCoverage(pct) {
  if (pct == null || pct === 0) return "#ffffff";
  if (pct >= 95) return "#c1a82c";
  if (pct >= 80) return "#e3c934";
  if (pct >= 60) return "#ecd966";
  if (pct >= 40) return "#f3e599";
  if (pct >= 20) return "#fbf3cc";
  return "#fef8de";
}

// Muted warm diverging palette — terracotta for losses, cream for flat,
// amber/brand-gold for gains. No primary red / green. Calibrated to feel
// editorial (think FT or Economist warm-tone maps).
function colorGrowth(growth) {
  if (growth == null) return "#f5f1e7";       // no data
  if (growth <= -20) return "#7a3a18";        // deep terracotta
  if (growth <= -10) return "#a3582f";        // terracotta
  if (growth <= -3)  return "#cc8a5e";        // warm peach
  if (growth <   3)  return "#f5e9b6";        // cream / held
  if (growth <  10)  return "#ecd966";        // light gold
  if (growth <  20)  return "#c1a82c";        // brand gold
  return "#7a6510";                            // deep amber
}

const NO_DATA_FILL = "#f5f1e7";

const FIXED_EXTENT = {
  REGIONAL: [[3.5, -13], [25, 16]],
  NIGERIA:  [[4.2, 2.7], [13.9, 14.7]],
  NIGER:    [[11.7, 0.2], [23.5, 15.9]],
  MALI:     [[10.2, -12.2], [24.9, 4.3]],
};
const FIT_MAX_ZOOM = { REGIONAL: 8, NIGERIA: 7, NIGER: 4.5, MALI: 7.5 };

function safeFit(map, bounds, maxZoom = 6) {
  try {
    if (!map || !bounds) return;
    map.invalidateSize(false);
    map.fitBounds(bounds, { padding: [0, 0], maxZoom });
  } catch { /* ignore */ }
}

function FixedExtent({ country, extent, maxZoom, focusGeo, onReady }) {
  const map = useMap();
  const computeFit = () => {
    if (focusGeo?.features?.length) {
      try {
        const b = L.geoJSON(focusGeo).getBounds();
        if (b.isValid()) return safeFit(map, b, 9);
      } catch { /* ignore */ }
    }
    safeFit(map, extent, maxZoom);
  };
  useEffect(() => {
    const id = requestAnimationFrame(computeFit);
    return () => cancelAnimationFrame(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country, extent, maxZoom, focusGeo, map]);
  useEffect(() => {
    const obs = new ResizeObserver(() => requestAnimationFrame(computeFit));
    const c = map.getContainer(); if (c) obs.observe(c);
    return () => obs.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extent, maxZoom, focusGeo, map]);
  useEffect(() => { onReady?.(map); }, [map, onReady]);
  return null;
}

function StateLabels({ geo }) {
  const map = useMap();
  useEffect(() => {
    if (!geo?.features?.length) return;
    const layers = [];
    for (const f of geo.features) {
      const p = f.properties || {};
      if (!p.name || !p.has_data) continue;
      try {
        const layer = L.geoJSON(f);
        const c = layer.getBounds().getCenter();
        const m = L.marker(c, {
          icon: L.divIcon({
            className: "map-label map-label--state",
            html: `<span>${String(p.name).toUpperCase()}</span>`,
            iconSize: null,
          }),
          interactive: false, keyboard: false,
        });
        m.addTo(map); layers.push(m);
      } catch { /* ignore */ }
    }
    return () => { layers.forEach((m) => map.removeLayer(m)); };
  }, [geo, map]);
  return null;
}

export default function MapView({
  country = "REGIONAL",
  filters = {},
  adminLevel = 1,
  onPolygonClick,
  showLegend = true,
  showViewToggle = true,        // home page hides this
  maxZoomOverride = null,       // per-page override (e.g. landing wants +1)
}) {
  const { t } = useTranslation();
  const [geo, setGeo] = useState(null);
  const [view, setView] = useState("coverage");        // "coverage" | "growth"
  const mapRef = useRef(null);
  const scope = country === "REGIONAL" ? undefined : country;
  const { setHovered } = useHover();

  useEffect(() => {
    let cancelled = false;
    setGeo(null);
    api.boundaries({
      country: scope, admin_level: adminLevel, view,
      state: filters.state, year: filters.year, quarter: filters.quarter, round: filters.round,
    }).then((g) => {
      if (cancelled) return;
      if (filters.state && g?.features) {
        const target = String(filters.state).toUpperCase();
        g = { ...g, features: g.features.filter(f =>
          String(f.properties?.name || "").toUpperCase() === target
        )};
      }
      setGeo(g);
    });
    return () => { cancelled = true; };
  }, [country, adminLevel, view, JSON.stringify(filters)]);

  const style = (f) => {
    const p = f.properties || {};
    // No-data: solid boundary line (matches data polygons), light cream fill.
    if (!p.has_data) {
      return { fillColor: NO_DATA_FILL, weight: 0.6, color: "#66625e",
               fillOpacity: 0.45 };
    }
    const fill = view === "growth" ? colorGrowth(p.growth_pct) : colorCoverage(p.percentage);
    return { fillColor: fill, weight: 0.6, color: "#66625e", fillOpacity: 0.92 };
  };

  const onEach = (feature, layer) => {
    const p = feature.properties || {};
    const noData = !p.has_data;
    const fmt = (n) => Number(n || 0).toLocaleString();
    const buildGrowthTip = () => {
      const gp = p.growth_pct;
      const change = (p.treated_now || 0) - (p.treated_prev || 0);
      const headline = gp >= 3
        ? `<span style="color:#ecd966">▲ ${gp}% ${t("growth_more_reached")}</span>`
        : gp <= -3
          ? `<span style="color:#e8a37e">▼ ${Math.abs(gp)}% ${t("growth_fewer_reached")}</span>`
          : `<span style="color:#f5e9b6">● ${t("growth_held_steady")} (${gp >= 0 ? "+" : ""}${gp}%)</span>`;
      const changeLine = change > 0
        ? `+${fmt(change)} ${t("growth_extra_children")}`
        : change < 0
          ? `−${fmt(-change)} ${t("growth_missing_children")}`
          : `${t("growth_no_change_count")}`;
      return `
        <div style="font:600 12px Inter,system-ui;color:#fff;line-height:1.5">
          <div style="font-size:13px;font-weight:800">${p.name}</div>
          <div style="margin:6px 0 4px 0;font-weight:700">${headline}</div>
          <div style="opacity:.9;font-weight:500">
            ${t("growth_last_round")} (R${p.round_prev}): <b>${fmt(p.treated_prev)}</b> ${t("growth_children")}<br/>
            ${t("growth_this_round")} (R${p.round_now}): <b>${fmt(p.treated_now)}</b> ${t("growth_children")}<br/>
            <span style="opacity:.95">${changeLine}</span>
          </div>
        </div>`;
    };

    const tip = noData
      ? `<div style="font:600 12px Inter,system-ui;color:#fff">
           <div style="font-size:13px;font-weight:800">${p.name}</div>
           <div style="opacity:.85;margin-top:4px">${
             view === "growth" ? t("growth_no_comparison") : t("no_data_available")
           }</div>
         </div>`
      : (view === "growth"
        ? buildGrowthTip()
        : `<div style="font:600 12px Inter,system-ui;color:#fff;line-height:1.4">
             <div style="font-size:13px;font-weight:800">${p.name}</div>
             <div style="opacity:.88;margin-top:3px">
               ${t("legend_treated")}: <b>${fmt(p.treated)}</b><br/>
               ${t("legend_eligible")}: <b>${fmt(p.eligible)}</b><br/>
               ${t("kpi_percentage")}: <b>${p.percentage ?? 0}%</b>
             </div>
           </div>`);
    layer.bindTooltip(tip, { sticky: true, direction: "top", offset: [0, -4] });

    layer.on("mouseover", (e) => {
      e.target.setStyle({ weight: 1.6, color: "#2a2825", fillOpacity: noData ? 0.55 : 1 });
      if (p.name) setHovered(p.name);
    });
    layer.on("mouseout",  (e) => {
      e.target.setStyle({ weight: 0.6, color: "#66625e",
                          fillOpacity: noData ? 0.45 : 0.92 });
      setHovered(null);
    });
    if (onPolygonClick) layer.on("click", () => onPolygonClick(p));
  };

  const extent  = FIXED_EXTENT[country] || FIXED_EXTENT.REGIONAL;
  const maxZoom = maxZoomOverride ?? (FIT_MAX_ZOOM[country] || 5);
  const geoKey  = useMemo(() => JSON.stringify(filters) + country + adminLevel + view, [country, adminLevel, view, filters]);

  const resetZoom = () => { if (mapRef.current) safeFit(mapRef.current, extent, maxZoom); };

  return (
    <div className="map-wrap">
      {/* View toggle (top-left). Hidden on the Landing page. */}
      {showViewToggle && (
        <div className="map-view-toggle" role="tablist" aria-label="Map view">
          <button role="tab" aria-selected={view === "coverage"}
                  className={`map-view-toggle__btn ${view === "coverage" ? "map-view-toggle__btn--on" : ""}`}
                  onClick={() => setView("coverage")}>{t("map_view_coverage")}</button>
          <button role="tab" aria-selected={view === "growth"}
                  className={`map-view-toggle__btn ${view === "growth" ? "map-view-toggle__btn--on" : ""}`}
                  onClick={() => setView("growth")}>{t("map_view_growth")}</button>
        </div>
      )}

      <MapContainer
        key={country}
        bounds={extent}
        scrollWheelZoom={true}
        zoomControl={false}
        attributionControl={true}
        zoomSnap={0.5}
        zoomDelta={0.5}
        style={{ width: "100%", height: "100%" }}
      >
        <Pane name="basemap" style={{ zIndex: 200, opacity: 0.35 }}>
          <TileLayer
            attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
            subdomains={["a","b","c","d"]}
          />
        </Pane>
        <Pane name="data" style={{ zIndex: 400 }}>
          {geo && (
            <GeoJSON key={geoKey} data={geo} style={style} onEachFeature={onEach} />
          )}
        </Pane>
        <Pane name="labels" style={{ zIndex: 650 }}>
          {geo && <StateLabels geo={geo} />}
        </Pane>
        <ZoomControl position="topright" />
        <FixedExtent
          country={country} extent={extent} maxZoom={maxZoom}
          focusGeo={filters.state ? geo : null}
          onReady={(m) => (mapRef.current = m)}
        />
      </MapContainer>

      <button className="map-reset" onClick={resetZoom}
              title={t("reset_zoom")} aria-label={t("reset_zoom")}>
        {/* home icon — distinct from the filter reset (which is a refresh arrow) */}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 11 12 3l9 8" />
          <path d="M5 10v10h14V10" />
        </svg>
      </button>

      {showLegend && (
        view === "growth" ? (
          <div className="legend">
            <div className="legend__title">{t("map_view_growth")} %</div>
            <div className="legend__bar legend__bar--diverging" />
            <div className="legend__ticks"><span>−20</span><span>0</span><span>+20</span></div>
          </div>
        ) : (
          <div className="legend">
            <div className="legend__title">{t("percentage_treated_legend")}</div>
            <div className="legend__bar" />
            <div className="legend__ticks"><span>0</span><span>50</span><span>100+</span></div>
          </div>
        )
      )}
    </div>
  );
}
