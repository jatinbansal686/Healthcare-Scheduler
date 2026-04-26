// ============================================================
// InquiryTable.tsx — Admin table displaying patient inquiries
// ============================================================

import React from 'react';
import type { InquiryRow } from '../../types/api.types';

interface InquiryTableProps {
  inquiries: InquiryRow[];
}

const statusColors: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  matched: 'bg-blue-100 text-blue-700',
  scheduled: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export const InquiryTable: React.FC<InquiryTableProps> = ({ inquiries }) => {
  console.log('[InquiryTable] render', { count: inquiries.length });

  if (inquiries.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-400 text-sm">
        No inquiries yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-100">
        <thead className="bg-slate-50">
          <tr>
            {['Patient ID', 'Problem', 'Insurance', 'Specialty', 'Therapist', 'Status', 'Date'].map((h) => (
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
          {inquiries.map((row) => (
            <tr key={row.id} className="hover:bg-slate-50 transition-colors">
              <td className="px-4 py-3 text-xs text-slate-400 font-mono">
                {row.patient_identifier?.slice(0, 8) ?? '—'}…
              </td>
              <td className="px-4 py-3 text-sm text-slate-700 max-w-xs">
                <span className="line-clamp-2">{row.problem_description}</span>
              </td>
              <td className="px-4 py-3 text-sm text-slate-600">
                {row.insurance_info ?? '—'}
              </td>
              <td className="px-4 py-3 text-sm text-slate-600">
                {row.extracted_specialty ?? '—'}
              </td>
              <td className="px-4 py-3 text-sm text-slate-600">
                {row.therapist?.name ?? '—'}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                    statusColors[row.status] ?? 'bg-slate-100 text-slate-600'
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
  );
};