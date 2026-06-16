// Shared fetch wrapper — always carries the Bearer token, applies same-origin
// credentials, and disables HTTP cache so cascading filter changes always
// reflect fresh server state. Used by every component that talks to /api/*.
import { auth } from "./auth.js";

const BASE = import.meta.env.VITE_API_BASE || "/api";
export const apiRoot = BASE.endsWith("/api") ? BASE : `${BASE}/api`;

export async function apiFetch(input, init = {}) {
  const url = String(input);
  const headers = new Headers(init.headers || {});
  const tk = auth.getToken();
  if (tk && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${tk}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const res = await fetch(url, { ...init, headers, credentials: "same-origin", cache: "no-store" });
  // If token expired/invalid, bounce to login.
  if (res.status === 401) {
    auth.clear();
    if (!url.endsWith("/auth/login")) window.location.assign("/login");
  }
  return res;
}

export const qs = (params = {}) => {
  const u = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "" && v !== "ALL") u.set(k, v);
  });
  const s = u.toString(); return s ? `?${s}` : "";
};
