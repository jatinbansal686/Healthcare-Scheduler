// ============================================================
// App.tsx — Root component with React Router DOM routes
// ============================================================

import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ChatPage from "./pages/ChatPage";
import AdminPage from "./pages/AdminPage";
import LoginPage from "./pages/LoginPage";
import { logger } from "./lib/logger";

const CONTEXT = "App";

const App: React.FC = () => {
  console.log("[App] render");
  logger.info(CONTEXT, "App mounted");

  return (
    <BrowserRouter>
      <Routes>
        {/* Patient chat — default route */}
        <Route path="/" element={<ChatPage />} />

        {/* Admin auth */}
        <Route path="/login" element={<LoginPage />} />

        {/* Admin dashboard */}
        <Route path="/admin" element={<AdminPage />} />

        {/* Fallback — redirect to chat */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
