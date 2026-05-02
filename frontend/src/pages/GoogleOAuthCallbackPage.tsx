// ============================================================
// pages/GoogleOAuthCallbackPage.tsx
// Handles the Google OAuth redirect after therapist grants calendar access.
// Flow: Google redirects here → exchange code → save tokens → back to dashboard
// ============================================================

import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { TherapistService } from "../services/TherapistService";
import { useTherapistAuth } from "../hooks/useTherapistAuth";
import { logger } from "../lib/logger";

const CONTEXT = "GoogleOAuthCallbackPage";
const therapistService = new TherapistService();

const GoogleOAuthCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { session, isLoading: authLoading } = useTherapistAuth();
  const [status, setStatus] = useState<"processing" | "success" | "error">(
    "processing",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Ref prevents the exchange running twice in React Strict Mode
  const exchangedRef = useRef(false);

  useEffect(() => {
    // Wait for auth to resolve before proceeding
    if (authLoading) return;

    const code = searchParams.get("code");
    const state = searchParams.get("state"); // therapistId encoded in state
    const error = searchParams.get("error"); // e.g. "access_denied"

    // ── Google returned an error ──────────────────────────
    if (error) {
      logger.warn(CONTEXT, "Google OAuth error param", { error });
      setStatus("error");
      setErrorMessage(
        error === "access_denied"
          ? "You declined calendar access. You can connect it later from your dashboard."
          : `Google returned an error: ${error}`,
      );
      return;
    }

    // ── Missing params ────────────────────────────────────
    if (!code || !state) {
      setStatus("error");
      setErrorMessage("Invalid callback — missing code or state.");
      return;
    }

    // ── Not authenticated ─────────────────────────────────
    if (!session) {
      logger.warn(
        CONTEXT,
        "No session during OAuth callback — redirecting to login",
      );
      navigate("/therapist/login", { replace: true });
      return;
    }

    // ── Already ran ───────────────────────────────────────
    if (exchangedRef.current) return;
    exchangedRef.current = true;

    const redirectUri = `${window.location.origin}/auth/google/callback`;

    logger.info(CONTEXT, "Exchanging OAuth code", { therapistId: state });

    therapistService
      .exchangeOAuthCode(session, code, state, redirectUri)
      .then((result) => {
        if (result.success) {
          logger.info(CONTEXT, "Calendar connected successfully");
          setStatus("success");
          // Brief pause so the user sees the success state, then go to dashboard
          setTimeout(() => {
            navigate("/therapist/dashboard?calendar=connected", {
              replace: true,
            });
          }, 1500);
        } else {
          setStatus("error");
          setErrorMessage(result.error ?? "Failed to connect calendar.");
        }
      })
      .catch((err) => {
        logger.error(CONTEXT, "Unexpected error during exchange", err);
        setStatus("error");
        setErrorMessage("An unexpected error occurred. Please try again.");
      });
  }, [authLoading, session, searchParams, navigate]);

  // ── UI ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 max-w-sm w-full text-center">
        {/* Processing */}
        {status === "processing" && (
          <>
            <div className="inline-block w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-slate-700 font-medium">
              Connecting your calendar…
            </p>
            <p className="text-slate-400 text-sm mt-1">
              This will only take a moment.
            </p>
          </>
        )}

        {/* Success */}
        {status === "success" && (
          <>
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-6 h-6 text-emerald-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <p className="text-slate-800 font-semibold">Calendar connected!</p>
            <p className="text-slate-400 text-sm mt-1">
              Redirecting to your dashboard…
            </p>
          </>
        )}

        {/* Error */}
        {status === "error" && (
          <>
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-6 h-6 text-red-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <p className="text-slate-800 font-semibold">Connection failed</p>
            <p className="text-slate-500 text-sm mt-1 mb-5">{errorMessage}</p>
            <button
              onClick={() =>
                navigate("/therapist/dashboard", { replace: true })
              }
              className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
            >
              Back to Dashboard
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default GoogleOAuthCallbackPage;
