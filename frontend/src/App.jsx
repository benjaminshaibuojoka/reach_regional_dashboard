import React, { lazy, Suspense } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Login from "./pages/Login.jsx";
import { auth } from "./auth.js";
import { HoverProvider } from "./context/HoverContext.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";

// Code-split the heavy dashboard pages (Recharts + Leaflet + html2canvas
// transitively) so the login bundle stays small.
const Landing     = lazy(() => import("./pages/Landing.jsx"));
const Regional    = lazy(() => import("./pages/Regional.jsx"));
const CountryPage = lazy(() => import("./pages/CountryPage.jsx"));

function Protected({ children }) {
  const location = useLocation();
  if (!auth.isAuthed()) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

function PageFallback() {
  return (
    <div style={{
      minHeight: "60vh", display: "flex", alignItems: "center",
      justifyContent: "center", color: "#66625e", fontSize: 13,
    }}>
      Loading…
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <HoverProvider>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/"          element={<Protected><Landing /></Protected>} />
            <Route path="/regional"  element={<Protected><Regional /></Protected>} />
            <Route path="/nigeria"   element={<Protected><CountryPage country="NIGERIA" /></Protected>} />
            <Route path="/niger"     element={<Protected><CountryPage country="NIGER" /></Protected>} />
            <Route path="/mali"      element={<Protected><CountryPage country="MALI" /></Protected>} />
          </Routes>
        </Suspense>
      </HoverProvider>
    </ErrorBoundary>
  );
}
