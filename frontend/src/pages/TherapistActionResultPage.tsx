// ============================================================
// pages/TherapistActionResultPage.tsx
// Shown after therapist clicks confirm/reject from email link.
// Reads ?status= query param and shows appropriate message.
// ============================================================

import React from "react";
import { useSearchParams, Link } from "react-router-dom";

type ResultStatus =
  | "confirmed"
  | "rejected"
  | "expired"
  | "already_actioned"
  | "not_found"
  | "invalid"
  | "error";

interface ResultConfig {
  icon: string;
  title: string;
  description: string;
  color: string;
  bg: string;
  border: string;
}

const RESULT_MAP: Record<ResultStatus, ResultConfig> = {
  confirmed: {
    icon: "✓",
    title: "Appointment Confirmed",
    description:
      "The appointment has been confirmed. The patient will be notified.",
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
  },
  rejected: {
    icon: "✕",
    title: "Appointment Declined",
    description:
      "The appointment has been declined. The patient will be notified.",
    color: "text-red-600",
    bg: "bg-red-50",
    border: "border-red-200",
  },
  expired: {
    icon: "⏰",
    title: "Link Expired",
    description:
      "This confirmation link has expired (24 hours). The appointment was automatically cancelled.",
    color: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
  },
  already_actioned: {
    icon: "ℹ",
    title: "Already Actioned",
    description: "This appointment has already been confirmed or declined.",
    color: "text-slate-600",
    bg: "bg-slate-50",
    border: "border-slate-200",
  },
  not_found: {
    icon: "?",
    title: "Not Found",
    description:
      "This confirmation link is invalid or the appointment no longer exists.",
    color: "text-slate-600",
    bg: "bg-slate-50",
    border: "border-slate-200",
  },
  invalid: {
    icon: "!",
    title: "Invalid Link",
    description:
      "This link is malformed. Please use the link from the notification email.",
    color: "text-slate-600",
    bg: "bg-slate-50",
    border: "border-slate-200",
  },
  error: {
    icon: "!",
    title: "Something went wrong",
    description:
      "An error occurred. Please try again or use your dashboard to manage this appointment.",
    color: "text-red-600",
    bg: "bg-red-50",
    border: "border-red-200",
  },
};

const TherapistActionResultPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const status = (searchParams.get("status") ?? "error") as ResultStatus;
  const config = RESULT_MAP[status] ?? RESULT_MAP.error;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 px-4">
      <div className="w-full max-w-md text-center">
        {/* Icon */}
        <div
          className={`inline-flex h-16 w-16 items-center justify-center rounded-2xl ${config.bg} border ${config.border} text-2xl font-bold ${config.color} mb-6`}
        >
          {config.icon}
        </div>

        <h1 className={`text-2xl font-bold mb-3 ${config.color}`}>
          {config.title}
        </h1>
        <p className="text-slate-500 text-sm leading-relaxed mb-8">
          {config.description}
        </p>

        <div className="flex flex-col gap-3">
          <Link
            to="/therapist/dashboard"
            className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
          >
            Go to Dashboard
          </Link>
          <Link
            to="/"
            className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default TherapistActionResultPage;
