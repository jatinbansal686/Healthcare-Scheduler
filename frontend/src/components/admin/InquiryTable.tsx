// import React from "react";
// import type { InquiryRow } from "../../types/api.types";

// interface InquiryTableProps {
//   inquiries: InquiryRow[];
// }

// const statusColors: Record<string, string> = {
//   pending: "bg-amber-100 text-amber-700",
//   matched: "bg-blue-100 text-blue-700",
//   scheduled: "bg-green-100 text-green-700",
//   failed: "bg-red-100 text-red-700",
//   cancelled: "bg-slate-100 text-slate-500",
// };

// function formatDate(iso: string): string {
//   try {
//     return new Date(iso).toLocaleDateString("en-US", {
//       month: "short",
//       day: "numeric",
//       year: "numeric",
//       hour: "2-digit",
//       minute: "2-digit",
//     });
//   } catch {
//     return iso;
//   }
// }

// function extractPatientName(summary: string | null | undefined): string {
//   if (!summary) return "—";
//   const match = summary.match(/Patient name:\s*(.+)/i);
//   return match ? match[1].trim() : "—";
// }

// function getTherapistName(row: InquiryRow): string {
//   // eslint-disable-next-line @typescript-eslint/no-explicit-any
//   const joined = (row as any).therapists;
//   if (!joined) return "—";
//   if (Array.isArray(joined)) return joined[0]?.name ?? "—";
//   return joined.name ?? "—";
// }

// export const InquiryTable: React.FC<InquiryTableProps> = ({ inquiries }) => {
//   console.log("[InquiryTable] render", { count: inquiries.length });

//   if (inquiries.length === 0) {
//     return (
//       <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 text-center text-slate-400 text-sm">
//         No inquiries yet.
//       </div>
//     );
//   }

//   return (
//     <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
//       <table className="min-w-full divide-y divide-slate-100">
//         <thead className="bg-slate-50">
//           <tr>
//             {[
//               "Patient",
//               "Symptoms",
//               "Insurance",
//               "Specialty",
//               "Therapist",
//               "Status",
//               "Date",
//             ].map((h) => (
//               <th
//                 key={h}
//                 className="px-3 sm:px-4 py-2.5 sm:py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap"
//               >
//                 {h}
//               </th>
//             ))}
//           </tr>
//         </thead>
//         <tbody className="divide-y divide-slate-50">
//           {inquiries.map((row) => (
//             <tr key={row.id} className="hover:bg-slate-50 transition-colors">
//               <td className="px-3 sm:px-4 py-2.5 sm:py-3 text-sm text-slate-700 whitespace-nowrap">
//                 {extractPatientName(row.raw_chat_summary) !== "—" ? (
//                   extractPatientName(row.raw_chat_summary)
//                 ) : (
//                   <span className="text-xs text-slate-400 font-mono">
//                     {row.patient_identifier?.slice(0, 8) ?? "—"}…
//                   </span>
//                 )}
//               </td>

//               <td className="px-3 sm:px-4 py-2.5 sm:py-3 max-w-[120px] sm:max-w-xs">
//                 {row.extracted_conditions &&
//                 row.extracted_conditions.length > 0 ? (
//                   <div className="flex flex-wrap gap-1">
//                     {row.extracted_conditions.map((c: string) => (
//                       <span
//                         key={c}
//                         className="inline-block rounded-full bg-teal-50 border border-teal-200 text-teal-700 px-2 py-0.5 text-xs capitalize"
//                       >
//                         {c}
//                       </span>
//                     ))}
//                   </div>
//                 ) : (
//                   <span className="text-sm text-slate-500 line-clamp-1">
//                     {row.problem_description ?? "—"}
//                   </span>
//                 )}
//               </td>

//               <td className="px-3 sm:px-4 py-2.5 sm:py-3 text-sm text-slate-600 capitalize whitespace-nowrap">
//                 {row.insurance_info ?? "—"}
//               </td>
//               <td className="px-3 sm:px-4 py-2.5 sm:py-3 text-sm text-slate-600 capitalize whitespace-nowrap">
//                 {row.primary_specialty ?? "—"}
//               </td>
//               <td className="px-3 sm:px-4 py-2.5 sm:py-3 text-sm text-slate-600 whitespace-nowrap">
//                 {getTherapistName(row)}
//               </td>
//               <td className="px-3 sm:px-4 py-2.5 sm:py-3">
//                 <span
//                   className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
//                     statusColors[row.status] ?? "bg-slate-100 text-slate-600"
//                   }`}
//                 >
//                   {row.status}
//                 </span>
//               </td>
//               <td className="px-3 sm:px-4 py-2.5 sm:py-3 text-xs text-slate-400 whitespace-nowrap">
//                 {formatDate(row.created_at)}
//               </td>
//             </tr>
//           ))}
//         </tbody>
//       </table>
//     </div>
//   );
// };

// ============================================================
// InquiryTable.tsx — Admin table for patient inquiries
// UI CHANGE: Desktop → scrollable table (unchanged look).
//            Mobile (< md) → card-per-row layout so nothing overflows.
// All data logic, types, helper functions unchanged.
// ============================================================

import React from "react";
import type { InquiryRow } from "../../types/api.types";

interface InquiryTableProps {
  inquiries: InquiryRow[];
}

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  matched: "bg-blue-100 text-blue-700",
  scheduled: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  cancelled: "bg-slate-100 text-slate-500",
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function extractPatientName(summary: string | null | undefined): string {
  if (!summary) return "—";
  const match = summary.match(/Patient name:\s*(.+)/i);
  return match ? match[1].trim() : "—";
}

function getTherapistName(row: InquiryRow): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const joined = (row as any).therapists;
  if (!joined) return "—";
  if (Array.isArray(joined)) return joined[0]?.name ?? "—";
  return joined.name ?? "—";
}

export const InquiryTable: React.FC<InquiryTableProps> = ({ inquiries }) => {
  console.log("[InquiryTable] render", { count: inquiries.length });

  if (inquiries.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 text-center text-slate-400 text-sm">
        No inquiries yet.
      </div>
    );
  }

  return (
    <>
      {/* ── Mobile card list (< md) ───────────────────────────── */}
      <div className="md:hidden flex flex-col gap-3">
        {inquiries.map((row) => {
          const patientName = extractPatientName(row.raw_chat_summary);
          const displayName =
            patientName !== "—"
              ? patientName
              : (row.patient_identifier?.slice(0, 8) ?? "—");
          const isAnon = patientName === "—";
          const statusCls =
            statusColors[row.status] ?? "bg-slate-100 text-slate-600";

          return (
            <div
              key={row.id}
              className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 space-y-3"
            >
              {/* Header: name + status */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Patient
                  </p>
                  <p
                    className={`text-sm font-semibold mt-0.5 ${
                      isAnon
                        ? "text-slate-400 font-mono text-xs"
                        : "text-slate-800"
                    }`}
                  >
                    {isAnon ? `${displayName}…` : displayName}
                  </p>
                </div>
                <span
                  className={`flex-shrink-0 inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusCls}`}
                >
                  {row.status}
                </span>
              </div>

              {/* Symptoms / Conditions */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
                  Symptoms
                </p>
                {row.extracted_conditions &&
                row.extracted_conditions.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {row.extracted_conditions.map((c: string) => (
                      <span
                        key={c}
                        className="inline-block rounded-full bg-teal-50 border border-teal-200 text-teal-700 px-2 py-0.5 text-xs capitalize"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 line-clamp-2">
                    {row.problem_description ?? "—"}
                  </p>
                )}
              </div>

              {/* Insurance + Specialty row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Insurance
                  </p>
                  <p className="text-sm text-slate-600 capitalize mt-0.5">
                    {row.insurance_info ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Specialty
                  </p>
                  <p className="text-sm text-slate-600 capitalize mt-0.5">
                    {row.primary_specialty ?? "—"}
                  </p>
                </div>
              </div>

              {/* Therapist + Date row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Therapist
                  </p>
                  <p className="text-sm text-slate-600 mt-0.5">
                    {getTherapistName(row)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Date
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {formatDate(row.created_at)}
                  </p>
                </div>
              </div>
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
                "Symptoms",
                "Insurance",
                "Specialty",
                "Therapist",
                "Status",
                "Date",
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
            {inquiries.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                  {extractPatientName(row.raw_chat_summary) !== "—" ? (
                    extractPatientName(row.raw_chat_summary)
                  ) : (
                    <span className="text-xs text-slate-400 font-mono">
                      {row.patient_identifier?.slice(0, 8) ?? "—"}…
                    </span>
                  )}
                </td>

                <td className="px-4 py-3 max-w-xs">
                  {row.extracted_conditions &&
                  row.extracted_conditions.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {row.extracted_conditions.map((c: string) => (
                        <span
                          key={c}
                          className="inline-block rounded-full bg-teal-50 border border-teal-200 text-teal-700 px-2 py-0.5 text-xs capitalize"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-sm text-slate-500 line-clamp-1">
                      {row.problem_description ?? "—"}
                    </span>
                  )}
                </td>

                <td className="px-4 py-3 text-sm text-slate-600 capitalize whitespace-nowrap">
                  {row.insurance_info ?? "—"}
                </td>
                <td className="px-4 py-3 text-sm text-slate-600 capitalize whitespace-nowrap">
                  {row.primary_specialty ?? "—"}
                </td>
                <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                  {getTherapistName(row)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                      statusColors[row.status] ?? "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {row.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                  {formatDate(row.created_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};
