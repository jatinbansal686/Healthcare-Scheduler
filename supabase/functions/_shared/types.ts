// ============================================================
// _shared/types.ts
// Shared domain types — single source of truth for all edge functions
// CHANGE: Added `structured_message` to SSEEventType.
//         All existing types are 100% unchanged.
// ============================================================

// ── Database row types ──────────────────────────────────────

export interface TherapistRow {
  id: string;
  name: string;
  email: string;
  bio: string;
  photo_url: string | null;
  years_experience: number | null;
  specialties: string[];
  accepted_insurance: string[];
  session_types: string[];
  languages: string[];
  google_calendar_id: string | null;
  google_refresh_token: string | null;
  google_oauth_connected_at: string | null;
  session_duration_minutes: number;
  availability_timezone: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type SafeTherapistRow = Omit<TherapistRow, "google_refresh_token">;

export interface InquiryRow {
  id: string;
  patient_identifier: string;
  problem_description: string;
  requested_schedule: string;
  insurance_info: string;
  extracted_conditions: string[];
  primary_specialty: string | null;
  matched_therapist_id: string | null;
  considered_therapist_ids: string[];
  status: InquiryStatus;
  raw_chat_summary: string | null;
  failure_reason: string | null;
  agent_loop_count: number;
  created_at: string;
  updated_at: string;
}

export interface AppointmentRow {
  id: string;
  inquiry_id: string;
  therapist_id: string;
  patient_identifier: string;
  start_time: string;
  end_time: string;
  google_calendar_event_id: string | null;
  google_meet_link: string | null;
  appointment_type: "individual" | "couples" | "group" | "family";
  status: AppointmentStatus;
  rescheduled_to_id: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConversationSessionRow {
  id: string;
  inquiry_id: string | null;
  messages: GeminiMessage[];
  tool_call_summary: ToolCallSummaryEntry[];
  session_state: SessionState;
  turn_count: number;
  total_tool_calls: number;
  session_status: SessionStatus;
  patient_identifier: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface ToolCallLogRow {
  id: number;
  session_id: string;
  gemini_turn_index: number;
  tool_name: string;
  input_params: Record<string, unknown>;
  output_result: Record<string, unknown> | null;
  success: boolean;
  error_code: string | null;
  error_message: string | null;
  duration_ms: number | null;
  called_at: string;
}

// ── Status enums ──────────────────────────────────────────────

export type InquiryStatus =
  | "pending"
  | "matched"
  | "availability_checked"
  | "scheduled"
  | "cancelled"
  | "failed";

export type AppointmentStatus =
  | "confirmed"
  | "cancelled_by_patient"
  | "cancelled_by_therapist"
  | "completed"
  | "no_show"
  | "rescheduled";

export type SessionStatus = "active" | "completed" | "abandoned" | "error";

// ── Gemini / Agent message types ──────────────────────────────

export interface GeminiTextPart {
  text: string;
}

export interface GeminiFunctionCallPart {
  functionCall: {
    name: string;
    args: Record<string, unknown>;
  };
}

export interface GeminiFunctionResponsePart {
  functionResponse: {
    name: string;
    response: Record<string, unknown>;
  };
}

export type GeminiPart =
  | GeminiTextPart
  | GeminiFunctionCallPart
  | GeminiFunctionResponsePart;

export interface GeminiMessage {
  role: "user" | "model";
  parts: GeminiPart[];
}

// ── Session state ─────────────────────────────────────────────

export interface SessionState {
  patientName: string | null;
  extractedConditions: string[];
  extractedInsurance: string | null;
  extractedSchedule: string | null;
  matchedTherapistId: string | null;
  checkedTherapistIds: string[];
  presentedSlots: AvailableSlot[];
  appointmentBooked: boolean;
  bookedInquiryId: string | null;
  lastToolUsed: string | null;
}

export interface AvailableSlot {
  therapistId: string;
  therapistName: string;
  startTime: string;
  endTime: string;
  displayTime: string;
}

export interface ToolCallSummaryEntry {
  toolName: string;
  success: boolean;
  durationMs: number;
  calledAt: string;
}

// ── SSE event types (streamed to frontend) ────────────────────
// OCP: Added `structured_message` — all existing event types unchanged.

export type SSEEventType =
  | "tool_start"
  | "tool_end"
  | "agent_thinking"
  | "agent_message" // kept for backwards compatibility
  | "structured_message" // NEW: replaces agent_message with typed payload
  | "error"
  | "done";

// ── Structured message payload ────────────────────────────────
// Emitted by AgentOrchestrator when AI calls respondToUser tool.
// Frontend reads this directly — no regex parsing needed.

export interface StructuredSlot {
  startTime: string;
  endTime?: string;
  label: string;
  therapistId: string;
  therapistName: string;
}

export interface StructuredTherapist {
  id: string;
  name: string;
  yearsExperience?: number;
  specialties?: string[];
  bio?: string;
  sessionTypes?: string[];
}

export interface StructuredConfirmation {
  therapistName: string;
  date: string;
  time: string;
  appointmentId?: string;
  meetLink?: string;
}

export type UIHint =
  | "text"
  | "slots"
  | "therapists"
  | "confirmation"
  | "out_of_scope";

export interface StructuredMessagePayload {
  message: string;
  ui_hint: UIHint;
  slots: StructuredSlot[] | null;
  therapists: StructuredTherapist[] | null;
  confirmation: StructuredConfirmation | null;
}

export interface SSEEvent {
  type: SSEEventType;
  data: Record<string, unknown>;
}

// ── API response shapes ───────────────────────────────────────

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

// ── Tool result shape ─────────────────────────────────────────

export interface ToolResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}
