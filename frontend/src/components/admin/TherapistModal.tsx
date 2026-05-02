// ============================================================
// components/admin/TherapistModal.tsx
// NEW: Modal that shows all therapist details.
//      Opened when the Therapists stat card is clicked.
//      Pure UI — receives therapists as prop, no data fetching.
//      SOLID: Single responsibility — only renders therapist list.
// ============================================================

import React from "react";
import type { TherapistRow } from "../../types/api.types";

interface TherapistModalProps {
  therapists: TherapistRow[];
  onClose: () => void;
}

export const TherapistModal: React.FC<TherapistModalProps> = ({
  therapists,
  onClose,
}) => {
  // Close on backdrop click
  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleBackdrop}
    >
      <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-800">All Therapists</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {therapists.length} therapist{therapists.length !== 1 ? "s" : ""}{" "}
              registered
            </p>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-400"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {therapists.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-8">
              No therapists found.
            </p>
          ) : (
            therapists.map((t) => (
              <div
                key={t.id}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3"
              >
                {/* Name + avatar */}
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 flex-shrink-0 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold text-base">
                    {t.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 text-sm sm:text-base break-words">
                      {t.name}
                    </p>
                    {t.google_calendar_id && (
                      <p className="text-xs text-teal-600 mt-0.5">
                        📅 Calendar connected
                      </p>
                    )}
                  </div>
                </div>

                {/* Bio */}
                {t.bio && (
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {t.bio}
                  </p>
                )}

                {/* Specialties */}
                {t.specialties?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
                      Specialties
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {t.specialties.map((s) => (
                        <span
                          key={s}
                          className="inline-block rounded-full bg-teal-100 text-teal-700 px-2 py-0.5 text-xs"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Insurance */}
                {t.accepted_insurance?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
                      Accepted Insurance
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {t.accepted_insurance.map((ins) => (
                        <span
                          key={ins}
                          className="inline-block rounded-full bg-slate-200 text-slate-600 px-2 py-0.5 text-xs"
                        >
                          {ins}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
