import { apiFetch, apiRoot, qs } from "./http.js";

async function get(path, params) {
  const r = await apiFetch(`${apiRoot}${path}${qs(params)}`);
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

async function post(path, body) {
  const r = await apiFetch(`${apiRoot}${path}`, { method: "POST", body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(data.detail || `${r.status}`), { data });
  return data;
}

export const api = {
  health:    () => get("/health"),
  filters:   (params) => get("/filters", params),
  kpis:      (params) => get("/kpis", params),
  byCountry: (params) => get("/by-country", params),
  byState:   (params) => get("/by-state", params),
  trend:     (params) => get("/trend", params),
  boundaries: (params) => get("/boundaries", params),
  downloadUrl: (params) => `${apiRoot}/download${qs(params)}`,
  login: (username, password) => post("/auth/login", { username, password }),
  refresh: (token) => post("/auth/refresh", { token }),
};
