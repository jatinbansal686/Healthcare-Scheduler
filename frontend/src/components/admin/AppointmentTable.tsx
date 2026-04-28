// ============================================================
// AppointmentTable.tsx — Admin table for booked appointments
// Fix 1: therapist join returns `therapists` (plural object) not `therapist`
// Fix 2: patient shown as name from admin_notes, not "anonymous" identifier
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

// Extract patient name from admin_notes ("Patient: John\nNotes: ...")
function extractPatientName(adminNotes: string | null | undefined): string {
  if (!adminNotes) return "—";
  const match = adminNotes.match(/^Patient:\s*(.+)$/m);
  return match ? match[1].trim() : "—";
}

// The Supabase join `therapists!therapist_id` returns a key named `therapists`
// (the table name), not `therapist`. Access it via index signature.
function getTherapistName(row: AppointmentRow): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const joined = (row as any).therapists;
  if (!joined) return "—";
  // Supabase may return array or single object depending on FK cardinality
  if (Array.isArray(joined)) return joined[0]?.name ?? "—";
  return joined.name ?? "—";
}

export const AppointmentTable: React.FC<AppointmentTableProps> = ({
  appointments,
}) => {
  console.log("[AppointmentTable] render", { count: appointments.length });

  if (appointments.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-400 text-sm">
        No appointments booked yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
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
                className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {appointments.map((row) => (
            <tr key={row.id} className="hover:bg-slate-50 transition-colors">
              <td className="px-4 py-3 text-sm text-slate-700">
                {extractPatientName(row.admin_notes)}
              </td>
              <td className="px-4 py-3 text-sm text-slate-700">
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
                    {row.google_calendar_event_id.slice(0, 16)}…
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
  );
};
