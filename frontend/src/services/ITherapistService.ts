// ============================================================
// services/ITherapistService.ts
// Interface for therapist authentication and dashboard data
// ============================================================

import type { Session, User } from "@supabase/supabase-js";

export interface TherapistProfile {
  id: string;
  name: string;
  email: string;
  specialties: string[];
  session_duration_minutes: number;
  availability_timezone: string;
  // Calendar connection status (fetched alongside profile)
  google_calendar_id: string | null;
  calendar_connected: boolean;
}

export interface AppointmentInquiry {
  id: string;
  problem_description: string;
  extracted_conditions: string[];
  primary_specialty: string | null;
  raw_chat_summary: string | null;
}

export interface TherapistAppointment {
  id: string;
  status:
    | "pending"
    | "confirmed"
    | "cancelled_by_patient"
    | "cancelled_by_therapist"
    | "completed"
    | "no_show"
    | "rescheduled";
  start_time: string;
  end_time: string;
  appointment_type: string;
  patient_identifier: string;
  admin_notes: string | null;
  confirmation_token_expires_at: string | null;
  therapist_action_at: string | null;
  therapist_rejection_reason: string | null;
  created_at: string;
  inquiry: AppointmentInquiry | null;
}

export interface DashboardStats {
  pending: number;
  confirmed: number;
  completed: number;
  cancelled: number;
  total: number;
}

export interface DashboardData {
  therapist: TherapistProfile;
  appointments: TherapistAppointment[];
  stats: DashboardStats;
}

export interface CalendarConnectResult {
  success: boolean;
  calendarId?: string;
  error?: string;
}

export interface ITherapistService {
  /** Sign in with Supabase email+password */
  signIn(
    email: string,
    password: string,
  ): Promise<{ session: Session; user: User }>;

  /** Sign out current therapist */
  signOut(): Promise<void>;

  /** Get current session */
  getSession(): Promise<Session | null>;

  /** Subscribe to auth state changes */
  onAuthStateChange(callback: (session: Session | null) => void): () => void;

  /** Fetch dashboard data (appointments + stats) for authenticated therapist */
  getDashboardData(
    session: Session,
    statusFilter?: string,
  ): Promise<DashboardData>;

  /**
   * Build the Google OAuth URL to redirect the therapist to.
   * Encodes therapistId in the `state` param so we can retrieve it on callback.
   */
  buildGoogleOAuthUrl(therapistId: string): string;

  /**
   * Exchange the OAuth authorization code (from Google redirect) for tokens,
   * then store them via the oauth-callback edge function.
   */
  exchangeOAuthCode(
    session: Session,
    code: string,
    therapistId: string,
    redirectUri: string,
  ): Promise<CalendarConnectResult>;

  /**
   * Disconnect Google Calendar — clears tokens from DB.
   */
  disconnectGoogleCalendar(
    session: Session,
    therapistId: string,
  ): Promise<void>;
}
