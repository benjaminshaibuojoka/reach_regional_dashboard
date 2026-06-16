import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api.js";
import { apiFetch, apiRoot as root } from "../http.js";
import { IconDownload } from "./Icons.jsx";

/* ---------- helpers --------------------------------------------------- */

function fmtScopeLine({ country, filters }) {
  const scope = country ? country : "All countries";
  const filt  = Object.entries(filters || {})
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `${k}: ${v}`).join(" · ");
  return filt ? `${scope}  ·  ${filt}` : scope;
}

async function fetchSourceLine(country) {
  try {
    const u = new URLSearchParams();
    if (country) u.set("country", country);
    const r = await apiFetch(`${root}/source-metadata${u.toString() ? "?" + u : ""}`);
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

// html2canvas struggles with Leaflet tile layers because they render via
// dynamically-positioned <img> tiles. The trick is to:
//   1. wait for every tile in every Leaflet container to finish loading,
//   2. force `allowTaint` + `useCORS` (CARTO tiles are CORS-clean),
//   3. give the browser one more frame to settle before snapshotting.
function waitForTileLoad(timeout = 4000) {
  const tiles = Array.from(document.querySelectorAll(".leaflet-tile"));
  if (!tiles.length) return Promise.resolve();
  const pending = tiles.filter(t => !t.complete || t.naturalWidth === 0);
  if (!pending.length) return Promise.resolve();
  return new Promise((resolve) => {
    let done = 0;
    const tick = () => { if (++done >= pending.length) resolve(); };
    pending.forEach(t => {
      t.addEventListener("load",  tick, { once: true });
      t.addEventListener("error", tick, { once: true });
    });
    setTimeout(resolve, timeout);   // hard cap
  });
}

async function snapshotCurrentView() {
  const [{ default: html2canvas }] = await Promise.all([import("html2canvas")]);
  // Let any in-flight tile finish loading.
  await waitForTileLoad();
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

  const node = document.querySelector(".app") || document.body;
  const canvas = await html2canvas(node, {
    backgroundColor: "#ffffff",
    scale: 1.5,
    useCORS: true,
    allowTaint: true,
    imageTimeout: 15000,
    logging: false,
    foreignObjectRendering: false,
    ignoreElements: (el) =>
      el.classList?.contains?.("chatbot-backdrop") ||
      el.classList?.contains?.("ai-drawer") ||
      el.classList?.contains?.("modal-backdrop") ||
      el.classList?.contains?.("modal") ||
      el.classList?.contains?.("dl-pop"),
  });
  return canvas;
}

async function downloadSnapshotPDF({ country, filters, baseName }) {
  const [{ jsPDF }] = await Promise.all([import("jspdf")]);
  const canvas = await snapshotCurrentView();
  const src    = await fetchSourceLine(country);
  const w = canvas.width, h = canvas.height;
  // Add a header strip (title + scope + source + timestamp), then the image.
  const headerH = 110;
  const pdf = new jsPDF({ orientation: w >= h ? "landscape" : "portrait", unit: "pt",
                          format: [w, h + headerH] });
  pdf.setFontSize(20); pdf.setTextColor(42, 40, 37);
  pdf.text("REACH Regional Dashboard", 30, 36);
  pdf.setFontSize(11); pdf.setTextColor(102, 98, 94);
  pdf.text(`Scope: ${fmtScopeLine({ country, filters })}`, 30, 60);
  if (src?.source) pdf.text(`Data Source: ${src.source}`, 30, 78);
  pdf.text(`Generated: ${new Date().toISOString().slice(0, 19).replace("T", " ")}  UTC`, 30, 96);
  pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, headerH, w, h);
  pdf.save(`${baseName}.pdf`);
}

async function downloadSnapshotPPT({ country, filters, baseName }) {
  const { default: PptxGenJS } = await import("pptxgenjs");
  const canvas = await snapshotCurrentView();
  const src    = await fetchSourceLine(country);
  const dataUrl = canvas.toDataURL("image/png");

  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";   // 13.33 × 7.5 in
  const slide = pptx.addSlide();

  slide.background = { color: "FFFFFF" };
  slide.addText("REACH Regional Dashboard", {
    x: 0.4, y: 0.2, w: 12.5, h: 0.5,
    fontSize: 22, bold: true, color: "2A2825",
  });
  slide.addText(`Scope: ${fmtScopeLine({ country, filters })}`, {
    x: 0.4, y: 0.7, w: 12.5, h: 0.3, fontSize: 11, color: "66625E",
  });
  if (src?.source) {
    slide.addText(`Data Source: ${src.source}`, {
      x: 0.4, y: 0.95, w: 12.5, h: 0.3, fontSize: 11, color: "66625E",
    });
  }
  slide.addText(`Generated: ${new Date().toISOString().slice(0, 19).replace("T", " ")} UTC`, {
    x: 0.4, y: 1.2, w: 12.5, h: 0.3, fontSize: 10, italic: true, color: "9C9489",
  });

  // Compute image placement — fit beneath the header strip
  const slideW = 13.33, slideH = 7.5;
  const headerH = 1.6;
  const ratio = canvas.width / canvas.height;
  const maxW = slideW - 0.8;
  const maxH = slideH - headerH - 0.3;
  let imgW = maxW, imgH = imgW / ratio;
  if (imgH > maxH) { imgH = maxH; imgW = imgH * ratio; }
  const x = (slideW - imgW) / 2, y = headerH;
  slide.addImage({ data: dataUrl, x, y, w: imgW, h: imgH });

  await pptx.writeFile({ fileName: `${baseName}.pptx` });
}

async function downloadCsvWithMetadataHeader({ country, filters, baseName }) {
  // Get the raw CSV from the existing backend endpoint
  const u = new URLSearchParams();
  Object.entries({ ...filters, format: "csv", country }).forEach(([k, v]) => {
    if (v != null && v !== "") u.set(k, v);
  });
  const res = await apiFetch(`${root}/download?${u.toString()}`);
  if (!res.ok) throw new Error(`CSV fetch HTTP ${res.status}`);
  const body = await res.text();

  const src = await fetchSourceLine(country);
  const header = [
    "# REACH Regional Dashboard — Data Export",
    `# Generated: ${new Date().toISOString().slice(0, 19).replace("T", " ")} UTC`,
    `# Scope: ${fmtScopeLine({ country, filters })}`,
    src?.source ? `# Data Source: ${src.source}` : null,
    src?.extraction_date ? `# Extraction Date: ${src.extraction_date}` : null,
    src?.last_validated  ? `# Last Validated: ${src.last_validated}`  : null,
    src?.version         ? `# Version: ${src.version}`                : null,
    "# Methodology: see the Methods drawer on each KPI in the dashboard",
    "",
  ].filter(Boolean).join("\n");

  const blob = new Blob([header + "\n" + body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${baseName}.csv`; a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a); a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 800);
}

async function downloadMethodologyPDF({ baseName, lang }) {
  const [{ jsPDF }] = await Promise.all([import("jspdf")]);
  const res = await apiFetch(`${root}/methodology?lang=${encodeURIComponent(lang || "en")}`);
  if (!res.ok) throw new Error(`Methodology fetch HTTP ${res.status}`);
  const { items = [] } = await res.json();

  // Standard A4 portrait, points (1pt = 1/72 in). 595 × 842.
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 48;
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const maxW  = pageW - margin * 2;
  let y = margin;

  const newPageIfNeeded = (h) => {
    if (y + h > pageH - margin) { pdf.addPage(); y = margin; }
  };

  // Cover
  pdf.setFontSize(22); pdf.setTextColor(42, 40, 37);
  pdf.text("REACH Regional Dashboard", margin, y); y += 28;
  pdf.setFontSize(14); pdf.setTextColor(102, 98, 94);
  pdf.text("Indicator Methodology Reference", margin, y); y += 22;
  pdf.setFontSize(10); pdf.setTextColor(156, 148, 137);
  pdf.text(`Generated: ${new Date().toISOString().slice(0, 19).replace("T", " ")} UTC`, margin, y); y += 16;
  pdf.text(`Language: ${(lang || "en").toUpperCase()}`, margin, y); y += 24;

  const writeWrapped = (text, fontSize, color = [42, 40, 37], leading = 1.35) => {
    if (!text || text === "—") return;
    pdf.setFontSize(fontSize); pdf.setTextColor(...color);
    const lines = pdf.splitTextToSize(String(text), maxW);
    const lh = fontSize * leading;
    for (const ln of lines) {
      newPageIfNeeded(lh);
      pdf.text(ln, margin, y); y += lh;
    }
  };

  const section = (label, value) => {
    if (!value || value === "—") return;
    newPageIfNeeded(20);
    pdf.setFontSize(10); pdf.setTextColor(102, 98, 94);
    pdf.text(label.toUpperCase(), margin, y); y += 13;
    writeWrapped(value, 10.5, [60, 56, 52]);
    y += 6;
  };

  const listSection = (label, arr) => {
    if (!arr || !arr.length) return;
    newPageIfNeeded(20);
    pdf.setFontSize(10); pdf.setTextColor(102, 98, 94);
    pdf.text(label.toUpperCase(), margin, y); y += 13;
    for (const item of arr) {
      const bullet = `• ${item}`;
      writeWrapped(bullet, 10.5, [60, 56, 52]);
    }
    y += 6;
  };

  items.forEach((m, idx) => {
    if (idx > 0) { pdf.addPage(); y = margin; }
    // Indicator title
    pdf.setFontSize(18); pdf.setTextColor(193, 168, 44);
    pdf.text(m.title || m.indicator, margin, y); y += 24;
    pdf.setDrawColor(227, 201, 52); pdf.setLineWidth(1.4);
    pdf.line(margin, y - 6, margin + 60, y - 6);
    y += 4;

    section("Definition",   m.definition);
    section("Formula",      m.formula);
    section("Numerator",    m.numerator);
    section("Denominator",  m.denominator);
    section("Exclusions",   m.exclusions);
    section("Source",       m.source);
    section("Frequency",    m.frequency);
    listSection("Assumptions", m.assumptions);
    listSection("References",  m.references);
  });

  // Footer on each page
  const total = pdf.internal.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8); pdf.setTextColor(156, 148, 137);
    pdf.text(`REACH Methodology Reference · Page ${i} of ${total}`,
             pageW / 2, pageH - 18, { align: "center" });
  }

  pdf.save(`${baseName}.pdf`);
}

/* ---------- component ------------------------------------------------- */

export default function DownloadMenu({ country, filters, onClose, anchorRef }) {
  const { t, i18n } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [pos, setPos] = useState({ top: 60, left: 0 });

  useEffect(() => {
    const place = () => {
      const rect = anchorRef?.current?.getBoundingClientRect?.();
      if (!rect) return;
      const popW = 240;
      const top  = Math.min(window.innerHeight - 240, rect.bottom + 8);
      const left = Math.max(8, Math.min(window.innerWidth - popW - 8, rect.right - popW));
      setPos({ top, left });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [anchorRef]);

  const scope = (country || "regional").toLowerCase();

  const runWithGuard = async (job) => {
    if (busy) return;
    setBusy(true);
    try { await job(); }
    catch (e) { console.error("[download] failed", e); alert("Download failed. Check the browser console."); }
    finally {
      setBusy(false);
      // Close on the NEXT macrotask so the download starts before unmount.
      setTimeout(() => onClose?.(), 250);
    }
  };

  const ctx = { country: country && country !== "REGIONAL" ? country : null, filters };

  const pdfCurrentView = () => runWithGuard(() =>
    downloadSnapshotPDF({ ...ctx, baseName: `reach_${scope}_view` }));
  const pdfAll  = () => runWithGuard(() => downloadSnapshotPDF({ ...ctx, baseName: `reach_${scope}` }));
  const pptAll  = () => runWithGuard(() => downloadSnapshotPPT({ ...ctx, baseName: `reach_${scope}` }));
  const csvAll  = () => runWithGuard(() => downloadCsvWithMetadataHeader({ ...ctx, baseName: `reach_${scope}` }));
  const methodsPdf = () => runWithGuard(() => downloadMethodologyPDF({
    baseName: `reach_methodology_${(i18n.language || "en").slice(0, 2)}`,
    lang: (i18n.language || "en").slice(0, 2),
  }));

  const pop = (
    <div className="dl-pop dl-pop--fixed" role="menu" style={{ top: pos.top, left: pos.left }}>
      <button type="button" className="dl-item dl-item--primary" onClick={pdfCurrentView} disabled={busy}>
        <IconDownload size={13} />
        <span>{busy ? "…" : t("download_view_pdf_short")}</span>
      </button>
      <div className="dl-sep">{t("download_all_data_short")}</div>
      <button type="button" className="dl-item" onClick={pdfAll} disabled={busy}>
        <IconDownload size={13} /><span>{t("download_pdf")}</span>
      </button>
      <button type="button" className="dl-item" onClick={pptAll} disabled={busy}>
        <IconDownload size={13} /><span>{t("download_pptx")}</span>
      </button>
      <button type="button" className="dl-item" onClick={csvAll} disabled={busy}>
        <IconDownload size={13} /><span>{t("download_csv")}</span>
      </button>
      <div className="dl-sep">{t("download_methodology_sep")}</div>
      <button type="button" className="dl-item" onClick={methodsPdf} disabled={busy}
              title={t("download_methodology_help")}>
        <IconDownload size={13} /><span>{t("download_methodology_pdf")}</span>
      </button>
    </div>
  );
  return createPortal(pop, document.body);
}
