// ============================================================
// AppointmentTable.tsx — Admin table for booked appointments
// UI CHANGE: Desktop → scrollable table (unchanged look).
//            Mobile (< md) → card-per-row layout so nothing overflows.
// All data logic, types, helper functions unchanged.
// ============================================================

import React from "react";
import type { AppointmentRow } from "../../types/api.types";

interface AppointmentTableProps {
  appointments: AppointmentRow[];
}

const statusColors: Record<string, string> = {
  confirmed: "bg-green-100 text-green-700",
  pending: "bg-amber-100 text-amber-700",
  cancelled: "bg-red-100 text-red-700",
  completed: "bg-slate-100 text-slate-600",
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function extractPatientName(adminNotes: string | null | undefined): string {
  if (!adminNotes) return "—";
  const match = adminNotes.match(/^Patient:\s*(.+)$/m);
  return match ? match[1].trim() : "—";
}

function getTherapistName(row: AppointmentRow): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const joined = (row as any).therapists;
  if (!joined) return "—";
  if (Array.isArray(joined)) return joined[0]?.name ?? "—";
  return joined.name ?? "—";
}

export const AppointmentTable: React.FC<AppointmentTableProps> = ({
  appointments,
}) => {
  console.log("[AppointmentTable] render", { count: appointments.length });

  if (appointments.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 text-center text-slate-400 text-sm">
        No appointments booked yet.
      </div>
    );
  }

  return (
    <>
      {/* ── Mobile card list (< md) ───────────────────────────── */}
      <div className="md:hidden flex flex-col gap-3">
        {appointments.map((row) => {
          const patient = extractPatientName(row.admin_notes);
          const therapist = getTherapistName(row);
          const statusCls =
            statusColors[row.status] ?? "bg-slate-100 text-slate-500";

          return (
            <div
              key={row.id}
              className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 space-y-3"
            >
              {/* Header row: patient + status */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Patient
                  </p>
                  <p className="text-sm font-semibold text-slate-800 mt-0.5">
                    {patient}
                  </p>
                </div>
                <span
                  className={`flex-shrink-0 inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusCls}`}
                >
                  {row.status}
                </span>
              </div>

              {/* Therapist */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Therapist
                </p>
                <p className="text-sm text-slate-700 mt-0.5">{therapist}</p>
              </div>

              {/* Times */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Start
                  </p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {formatDate(row.start_time)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    End
                  </p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {formatDate(row.end_time)}
                  </p>
                </div>
              </div>

              {/* Calendar event ID */}
              {row.google_calendar_event_id && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Calendar Event
                  </p>
                  <p className="text-xs font-mono text-teal-600 mt-0.5 break-all">
                    {row.google_calendar_event_id.slice(0, 20)}…
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Desktop table (md+) ──────────────────────────────── */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50">
            <tr>
              {[
                "Patient",
                "Therapist",
                "Start Time",
                "End Time",
                "Status",
                "Calendar Event",
              ].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {appointments.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                  {extractPatientName(row.admin_notes)}
                </td>
                <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                  {getTherapistName(row)}
                </td>
                <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                  {formatDate(row.start_time)}
                </td>
                <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                  {formatDate(row.end_time)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                      statusColors[row.status] ?? "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {row.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-400 font-mono">
                  {row.google_calendar_event_id ? (
                    <span className="text-teal-600 truncate max-w-[8rem] block">
                      {row.google_calendar_event_id.slice(0, 14)}…
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};
