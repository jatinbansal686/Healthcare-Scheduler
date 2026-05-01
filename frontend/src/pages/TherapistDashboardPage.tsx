// ============================================================
// pages/TherapistDashboardPage.tsx
// Therapist dashboard — view pending/confirmed appointments,
// confirm or reject pending ones via inline action buttons.
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTherapistAuth } from '../hooks/useTherapistAuth';
import { TherapistService } from '../services/TherapistService';
import type { TherapistAppointment, DashboardData, DashboardStats } from '../services/ITherapistService';
import { logger } from '../lib/logger';
import { logAndNormalize } from '../lib/errorHandler';

const CONTEXT = 'TherapistDashboardPage';
const therapistService = new TherapistService();

// ── Sub-components ─────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number;
  color: string;
  bg: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, color, bg }) => (
  <div className={`rounded-xl border ${bg} p-5`}>
    <p className={`text-2xl font-bold ${color}`}>{value}</p>
    <p className="text-sm text-slate-500 mt-1">{label}</p>
  </div>
);

interface StatusBadgeProps {
  status: TherapistAppointment['status'];
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const map: Record<string, { label: string; classes: string }> = {
    pending:                 { label: 'Pending',    classes: 'bg-amber-100 text-amber-700 border-amber-200' },
    confirmed:               { label: 'Confirmed',  classes: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    completed:               { label: 'Completed',  classes: 'bg-slate-100 text-slate-600 border-slate-200' },
    cancelled_by_patient:    { label: 'Cancelled',  classes: 'bg-red-100 text-red-600 border-red-200' },
    cancelled_by_therapist:  { label: 'Declined',   classes: 'bg-red-100 text-red-600 border-red-200' },
    no_show:                 { label: 'No Show',    classes: 'bg-orange-100 text-orange-600 border-orange-200' },
    rescheduled:             { label: 'Rescheduled',classes: 'bg-blue-100 text-blue-600 border-blue-200' },
  };
  const { label, classes } = map[status] ?? { label: status, classes: 'bg-slate-100 text-slate-600' };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${classes}`}>
      {label}
    </span>
  );
};

interface AppointmentCardProps {
  appointment: TherapistAppointment;
  onConfirm: (id: string) => void;
  onReject: (id: string) => void;
  actionLoading: string | null;
}

const AppointmentCard: React.FC<AppointmentCardProps> = ({
  appointment: appt,
  onConfirm,
  onReject,
  actionLoading,
}) => {
  const start = new Date(appt.start_time);
  const end = new Date(appt.end_time);

  const formattedDate = start.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
  const formattedTime = `${start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} – ${end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  const durationMin = Math.round((end.getTime() - start.getTime()) / 60000);

  const expiresAt = appt.confirmation_token_expires_at
    ? new Date(appt.confirmation_token_expires_at)
    : null;
  const hoursLeft = expiresAt
    ? Math.max(0, Math.round((expiresAt.getTime() - Date.now()) / 3600000))
    : null;

  const isActioning = actionLoading === appt.id;

  return (
    <div className={`rounded-xl border bg-white p-5 shadow-sm transition-all ${
      appt.status === 'pending' ? 'border-amber-200 ring-1 ring-amber-100' : 'border-slate-200'
    }`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="font-semibold text-slate-800 text-sm">{formattedDate}</p>
          <p className="text-slate-500 text-xs mt-0.5">{formattedTime} · {durationMin} min</p>
        </div>
        <StatusBadge status={appt.status} />
      </div>

      {/* Details */}
      <div className="space-y-1.5 mb-4">
        <div className="flex gap-2 text-xs text-slate-600">
          <span className="font-medium w-24 shrink-0">Patient ID</span>
          <span className="font-mono text-slate-500">{appt.patient_identifier}</span>
        </div>
        <div className="flex gap-2 text-xs text-slate-600">
          <span className="font-medium w-24 shrink-0">Type</span>
          <span className="capitalize">{appt.appointment_type}</span>
        </div>
        {appt.inquiry?.extracted_conditions?.length > 0 && (
          <div className="flex gap-2 text-xs text-slate-600">
            <span className="font-medium w-24 shrink-0">Conditions</span>
            <span>{appt.inquiry.extracted_conditions.join(', ')}</span>
          </div>
        )}
        {appt.inquiry?.raw_chat_summary && (
          <div className="flex gap-2 text-xs text-slate-600">
            <span className="font-medium w-24 shrink-0 mt-0.5">Summary</span>
            <span className="text-slate-500 leading-relaxed">{appt.inquiry.raw_chat_summary}</span>
          </div>
        )}
        {appt.admin_notes && (
          <div className="flex gap-2 text-xs text-slate-600">
            <span className="font-medium w-24 shrink-0">Notes</span>
            <span className="text-slate-500">{appt.admin_notes}</span>
          </div>
        )}
      </div>

      {/* Pending actions */}
      {appt.status === 'pending' && (
        <div className="border-t border-amber-100 pt-3">
          {hoursLeft !== null && (
            <p className="text-xs text-amber-600 mb-2.5">
              ⏰ Auto-cancels in {hoursLeft}h if no action taken
            </p>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => onConfirm(appt.id)}
              disabled={isActioning}
              className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isActioning ? '...' : '✓ Confirm'}
            </button>
            <button
              onClick={() => onReject(appt.id)}
              disabled={isActioning}
              className="flex-1 rounded-lg border-2 border-red-500 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isActioning ? '...' : '✕ Decline'}
            </button>
          </div>
        </div>
      )}

      {/* Rejection reason */}
      {appt.status === 'cancelled_by_therapist' && appt.therapist_rejection_reason && (
        <div className="border-t border-slate-100 pt-2 mt-2">
          <p className="text-xs text-slate-400">Reason: {appt.therapist_rejection_reason}</p>
        </div>
      )}
    </div>
  );
};

// ── Main Page ──────────────────────────────────────────────

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

type FilterTab = 'pending' | 'confirmed' | 'all';

const TherapistDashboardPage: React.FC = () => {
  logger.info(CONTEXT, 'TherapistDashboardPage mounted');

  const navigate = useNavigate();
  const { session, isLoading: authLoading, signOut } = useTherapistAuth();

  const [dashData, setDashData] = useState<DashboardData | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>('pending');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !session) {
      logger.info(CONTEXT, 'No session — redirecting to therapist login');
      navigate('/therapist/login', { replace: true });
    }
  }, [session, authLoading, navigate]);

  // Load dashboard data
  const loadData = useCallback(async () => {
    if (!session) return;
    setDataLoading(true);
    setDataError(null);
    try {
      const data = await therapistService.getDashboardData(session, activeTab);
      setDashData(data);
    } catch (err) {
      const normalized = logAndNormalize(CONTEXT, err);
      setDataError(normalized.message);
    } finally {
      setDataLoading(false);
    }
  }, [session, activeTab]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Inline confirm/reject (via admin API — no token needed since therapist is authed) ──
  const handleAction = async (appointmentId: string, action: 'confirm' | 'reject') => {
    if (!session) return;
    setActionLoading(appointmentId);
    setActionMessage(null);

    try {
      const newStatus = action === 'confirm' ? 'confirmed' : 'cancelled_by_therapist';
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/therapist-dashboard-data`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': SUPABASE_ANON_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ appointmentId, status: newStatus }),
        },
      );

      if (!response.ok) {
        throw new Error(`Action failed: ${response.status}`);
      }

      setActionMessage({
        type: 'success',
        text: action === 'confirm' ? 'Appointment confirmed!' : 'Appointment declined.',
      });

      // Refresh data after action
      await loadData();
    } catch (err) {
      const normalized = logAndNormalize(CONTEXT, err);
      setActionMessage({ type: 'error', text: normalized.message });
    } finally {
      setActionLoading(null);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/therapist/login', { replace: true });
  };

  // ── Filter appointments for active tab ─────────────────
  const filteredAppointments = dashData?.appointments.filter((a) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'pending') return a.status === 'pending';
    if (activeTab === 'confirmed') return ['confirmed', 'completed'].includes(a.status);
    return true;
  }) ?? [];

  // ── Loading skeleton ───────────────────────────────────
  if (authLoading || (dataLoading && !dashData)) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-slate-500 text-sm">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  const stats = dashData?.stats;
  const therapist = dashData?.therapist;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Nav */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white text-xs font-bold">
              Rx
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800 leading-tight">
                {therapist?.name ?? 'Dashboard'}
              </p>
              <p className="text-xs text-slate-400 leading-tight">Therapist Portal</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="text-xs text-slate-500 hover:text-red-600 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Error banner */}
        {dataError && (
          <div className="mb-6 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {dataError}
            <button onClick={loadData} className="ml-3 underline text-red-600 text-xs">Retry</button>
          </div>
        )}

        {/* Action message */}
        {actionMessage && (
          <div className={`mb-6 rounded-xl border px-4 py-3 text-sm ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}>
            {actionMessage.text}
          </div>
        )}

        {/* Stats row */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            <StatCard label="Pending"   value={stats.pending}   color="text-amber-600"   bg="border-amber-100 bg-amber-50" />
            <StatCard label="Confirmed" value={stats.confirmed} color="text-emerald-600" bg="border-emerald-100 bg-emerald-50" />
            <StatCard label="Completed" value={stats.completed} color="text-slate-600"   bg="border-slate-200 bg-white" />
            <StatCard label="Cancelled" value={stats.cancelled} color="text-red-500"     bg="border-red-100 bg-red-50" />
          </div>
        )}

        {/* Pending alert banner */}
        {(stats?.pending ?? 0) > 0 && (
          <div className="mb-6 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-center gap-3">
            <span className="text-amber-500 text-lg">⏳</span>
            <p className="text-sm text-amber-700">
              You have <strong>{stats?.pending}</strong> pending appointment{stats?.pending !== 1 ? 's' : ''} awaiting your confirmation.
            </p>
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-xl w-fit">
          {(['pending', 'confirmed', 'all'] as FilterTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all capitalize ${
                activeTab === tab
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab}
              {tab === 'pending' && stats?.pending ? (
                <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-500 text-white text-xs">
                  {stats.pending}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {/* Appointments grid */}
        {dataLoading ? (
          <div className="grid sm:grid-cols-2 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border border-slate-200 bg-white p-5 animate-pulse">
                <div className="h-4 bg-slate-100 rounded w-2/3 mb-2" />
                <div className="h-3 bg-slate-100 rounded w-1/2 mb-4" />
                <div className="h-3 bg-slate-100 rounded w-full mb-2" />
                <div className="h-3 bg-slate-100 rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : filteredAppointments.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-slate-400 text-sm">
              {activeTab === 'pending'
                ? 'No pending appointments. You\'re all caught up! ✓'
                : 'No appointments found for this filter.'}
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {filteredAppointments.map((appt) => (
              <AppointmentCard
                key={appt.id}
                appointment={appt}
                onConfirm={(id) => handleAction(id, 'confirm')}
                onReject={(id) => handleAction(id, 'reject')}
                actionLoading={actionLoading}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default TherapistDashboardPage;