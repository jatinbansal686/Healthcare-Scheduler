// ============================================================
// frontend/src/types/index.ts
// All frontend TypeScript types — single source of truth
// ============================================================

// ── Chat / Agent types ────────────────────────────────────────

export type SSEEventType =
  | "tool_start"
  | "tool_end"
  | "agent_thinking"
  | "agent_message"
  | "error"
  | "done";

export interface SSEEvent {
  type: SSEEventType;
  data: Record<string, unknown>;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  toolEvents?: ToolEvent[];
}

export interface ToolEvent {
  toolName: string;
  status: "running" | "success" | "error";
  durationMs?: number;
  result?: Record<string, unknown>;
  error?: string;
}

// ── Therapist types ───────────────────────────────────────────

export interface Therapist {
  id: string;
  name: string;
  title: string;
  bio: string | null;
  specialties: string[];
  accepted_insurance: string[];
  languages: string[];
  session_types: string[];
  profile_image_url: string | null;
  is_accepting_patients: boolean;
  phone: string | null;
  google_calendar_id?: string | null;
}

// ── Inquiry types ─────────────────────────────────────────────

export type InquiryStatus =
  | "pending"
  | "matched"
  | "scheduled"
  | "failed"
  | "cancelled";

export interface Inquiry {
  id: string;
  patient_name: string | null;
  patient_identifier: string | null;
  problem_description: string;
  extracted_conditions: string[];
  extracted_insurance: string | null;
  extracted_schedule: string | null;
  status: InquiryStatus;
  created_at: string;
  updated_at: string;
  therapists?: {
    id: string;
    name: string;
    title: string;
  } | null;
}

// ── Appointment types ─────────────────────────────────────────

export type AppointmentStatus =
  | "confirmed"
  | "cancelled"
  | "completed"
  | "no_show";

export interface Appointment {
  id: string;
  patient_name: string | null;
  patient_identifier: string | null;
  start_time: string;
  end_time: string;
  status: AppointmentStatus;
  google_calendar_event_id: string | null;
  notes: string | null;
  created_at: string;
  therapists?: {
    id: string;
    name: string;
    title: string;
    phone: string | null;
  } | null;
}

// ── Admin dashboard types ─────────────────────────────────────

export interface AdminStats {
  totalInquiries: number;
  byStatus: Record<string, number>;
}

export interface AdminData {
  inquiries: Inquiry[];
  appointments: Appointment[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
  stats: AdminStats;
}

// ── API response types ────────────────────────────────────────

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

