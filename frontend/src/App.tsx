// ============================================================
// App.tsx — Root component with React Router DOM routes
// Added: /therapist/login, /therapist/dashboard, /therapist/action-result
// Existing routes unchanged.
// ============================================================

import React, { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ChatPage from "./pages/ChatPage";
import AdminPage from "./pages/AdminPage";
import LoginPage from "./pages/LoginPage";
import { logger } from "./lib/logger";

// Lazy-load therapist pages — keeps main bundle unchanged
const TherapistLoginPage = lazy(() => import("./pages/TherapistLoginPage"));
const TherapistDashboardPage = lazy(
  () => import("./pages/TherapistDashboardPage"),
);
const TherapistActionResultPage = lazy(
  () => import("./pages/TherapistActionResultPage"),
);

const CONTEXT = "App";

// Minimal fallback while lazy chunks load
const PageLoader: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50">
    <div className="w-7 h-7 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
  </div>
);

const App: React.FC = () => {
  console.log("[App] render");
  logger.info(CONTEXT, "App mounted");

  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* ── Patient routes (unchanged) ── */}
          <Route path="/" element={<ChatPage />} />

          {/* ── Admin routes (unchanged) ── */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin" element={<AdminPage />} />

          {/* ── Therapist routes (new) ── */}
          <Route path="/therapist/login" element={<TherapistLoginPage />} />
          <Route
            path="/therapist/dashboard"
            element={<TherapistDashboardPage />}
          />
          {/* Result page after clicking confirm/reject link in email */}
          <Route
            path="/therapist/action-result"
            element={<TherapistActionResultPage />}
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};

export default App;
