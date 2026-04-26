// ============================================================
// main.tsx — React application entry point
// ============================================================

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { logger } from "./lib/logger";

logger.info("main", "Application starting up", {
  env: import.meta.env.MODE,
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL ? "✓ set" : "✗ MISSING",
  supabaseKey: import.meta.env.VITE_SUPABASE_ANON_KEY ? "✓ set" : "✗ MISSING",
});

const rootElement = document.getElementById("root");

if (!rootElement) {
  console.error("[main] Root element #root not found in DOM");
  throw new Error("Root element not found. Check index.html.");
}

logger.info("main", "Mounting React app to #root");

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

logger.info("main", "React app mounted successfully");
