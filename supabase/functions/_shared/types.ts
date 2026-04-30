// // ============================================================
// // _shared/types.ts
// // Shared domain types — single source of truth for all edge functions
// // EVERY field name here must exactly match the column name in migrations.
// // If you change a migration column name, change it here too — and vice versa.
// // ============================================================

// // ── Database row types ──────────────────────────────────────
// // These mirror the exact column names from supabase/migrations/

// export interface TherapistRow {
//   // Primary key
//   id: string;

//   // Identity — matches migration 001
//   name: string;
//   email: string;
//   bio: string; // NOT NULL in migration
//   photo_url: string | null;
//   years_experience: number | null;

//   // Clinical matching fields — migration 001
//   specialties: string[];
//   accepted_insurance: string[];
//   session_types: string[];
//   languages: string[];

//   // Google Calendar — migration 001
//   google_calendar_id: string | null;
//   google_refresh_token: string | null; // Never returned via safe_therapists view
//   google_oauth_connected_at: string | null;

//   // Scheduling config — migration 001
//   session_duration_minutes: number;
//   availability_timezone: string;

//   // Status
//   is_active: boolean;

//   // Audit
//   created_at: string;
//   updated_at: string;
// }

// // TherapistRow without the sensitive OAuth token — matches safe_therapists view
// export type SafeTherapistRow = Omit<TherapistRow, "google_refresh_token">;

// export interface InquiryRow {
//   // Primary key
//   id: string;

//   // Patient identity — migration 002
//   patient_identifier: string;

//   // Raw patient input — migration 002
//   problem_description: string;
//   requested_schedule: string;
//   insurance_info: string;

//   // AI-extracted structured data — migration 002
//   extracted_conditions: string[];
//   primary_specialty: string | null;

//   // Matching result — migration 002
//   matched_therapist_id: string | null;
//   considered_therapist_ids: string[];

//   // State machine — migration 002
//   // 'pending' → 'matched' → 'availability_checked' → 'scheduled' | 'cancelled' | 'failed'
//   status: InquiryStatus;

//   // Admin review fields — migration 002
//   raw_chat_summary: string | null;
//   failure_reason: string | null;
//   agent_loop_count: number;

//   // Audit
//   created_at: string;
//   updated_at: string;
// }

// export interface AppointmentRow {
//   // Primary key
//   id: string;

//   // Foreign keys — migration 003
//   inquiry_id: string;
//   therapist_id: string;

//   // Patient reference — migration 003
//   patient_identifier: string;

//   // Time — migration 003 (always UTC via TIMESTAMPTZ)
//   start_time: string;
//   end_time: string;

//   // Google Calendar — migration 003
//   google_calendar_event_id: string | null;
//   google_meet_link: string | null;

//   // Appointment type — migration 003
//   appointment_type: "individual" | "couples" | "group" | "family";

//   // Status — migration 003
//   status: AppointmentStatus;

//   // Rescheduling — migration 003
//   rescheduled_to_id: string | null;

//   // Admin only — migration 003
//   admin_notes: string | null;

//   // Audit
//   created_at: string;
//   updated_at: string;
// }

// export interface ConversationSessionRow {
//   // Primary key (also used as session token in frontend)
//   id: string;

//   // FK to inquiry — migration 004 (null until saveInquiry tool runs)
//   inquiry_id: string | null;

//   // The full Gemini Content[] array — replayed on every turn
//   // Structure: [{ role: 'user'|'model', parts: [...] }]
//   messages: GeminiMessage[];

//   // Denormalized tool summary for analytics — migration 004
//   // Structure: [{ toolName, success, durationMs, calledAt }]
//   tool_call_summary: ToolCallSummaryEntry[];

//   // Orchestrator state bag — migration 004 (column: session_state)
//   // Note: column is named "session_state" in DB, aliased here for clarity
//   session_state: SessionState;

//   // Counters — migration 004
//   turn_count: number;
//   total_tool_calls: number;

//   // Session lifecycle — migration 004
//   session_status: SessionStatus;

//   // Patient identity
//   patient_identifier: string | null;

//   // Expiry — migration 004
//   expires_at: string;

//   // Audit
//   created_at: string;
//   updated_at: string;
// }

// export interface ToolCallLogRow {
//   // Primary key (bigserial) — migration 005
//   id: number;

//   // FK to session — migration 005
//   session_id: string;

//   // Turn tracking — migration 005
//   gemini_turn_index: number;

//   // Tool identity — migration 005
//   tool_name: string;

//   // Input/output — migration 005 (columns: input_params, output_result)
//   input_params: Record<string, unknown>;
//   output_result: Record<string, unknown> | null;

//   // Result — migration 005
//   success: boolean;
//   error_code: string | null;
//   error_message: string | null;

//   // Performance — migration 005
//   duration_ms: number | null;

//   // Timestamp (no updated_at — append-only)
//   called_at: string;
// }

// // ── Status enums ──────────────────────────────────────────────
// // Values must exactly match the CHECK constraints in migrations

// export type InquiryStatus =
//   | "pending"
//   | "matched"
//   | "availability_checked" // Added to match migration 002 CHECK constraint
//   | "scheduled"
//   | "cancelled"
//   | "failed";

// export type AppointmentStatus =
//   | "confirmed"
//   | "cancelled_by_patient" // Matches migration 003 CHECK constraint
//   | "cancelled_by_therapist" // Matches migration 003 CHECK constraint
//   | "completed"
//   | "no_show"
//   | "rescheduled"; // Matches migration 003 CHECK constraint

// export type SessionStatus = "active" | "completed" | "abandoned" | "error";

// // ── Gemini / Agent message types ──────────────────────────────
// // These mirror the Google AI SDK Content/Part types exactly

// export interface GeminiTextPart {
//   text: string;
// }

// export interface GeminiFunctionCallPart {
//   functionCall: {
//     name: string;
//     args: Record<string, unknown>;
//   };
// }

// export interface GeminiFunctionResponsePart {
//   functionResponse: {
//     name: string;
//     response: Record<string, unknown>;
//   };
// }

// export type GeminiPart =
//   | GeminiTextPart
//   | GeminiFunctionCallPart
//   | GeminiFunctionResponsePart;

// export interface GeminiMessage {
//   role: "user" | "model";
//   parts: GeminiPart[];
// }

// // ── Session state ─────────────────────────────────────────────
// // Stored in conversation_sessions.session_state (JSONB)
// // Carries orchestrator state between HTTP requests

// export interface SessionState {
//   // What the patient told us (extracted by extractPatientInfo tool)
//   patientName: string | null;
//   extractedConditions: string[];
//   extractedInsurance: string | null;
//   extractedSchedule: string | null;

//   // Matching progress
//   matchedTherapistId: string | null;
//   checkedTherapistIds: string[]; // Therapists whose availability was already checked
//   presentedSlots: AvailableSlot[]; // Slots shown to patient, awaiting confirmation

//   // Booking outcome
//   appointmentBooked: boolean;
//   bookedInquiryId: string | null;

//   // Last tool used (for debugging)
//   lastToolUsed: string | null;
// }

// export interface AvailableSlot {
//   therapistId: string;
//   therapistName: string;
//   startTime: string; // ISO 8601
//   endTime: string; // ISO 8601
//   displayTime: string; // Human-readable: "Monday Jan 27 at 6:00 PM"
// }

// // Denormalized entry in tool_call_summary array
// export interface ToolCallSummaryEntry {
//   toolName: string;
//   success: boolean;
//   durationMs: number;
//   calledAt: string; // ISO 8601
// }

// // ── SSE event types (streamed to frontend) ────────────────────

// export type SSEEventType =
//   | "tool_start"
//   | "tool_end"
//   | "agent_thinking"
//   | "agent_message"
//   | "error"
//   | "done";

// export interface SSEEvent {
//   type: SSEEventType;
//   data: Record<string, unknown>;
// }

// // ── API response shapes ───────────────────────────────────────

// export interface ApiSuccess<T> {
//   success: true;
//   data: T;
// }

// export interface ApiError {
//   success: false;
//   error: {
//     code: string;
//     message: string;
//   };
// }

// export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// // ── Tool result shape ─────────────────────────────────────────
// // Every ITool.execute() returns this shape

// export interface ToolResult {
//   success: boolean;
//   data?: Record<string, unknown>;
//   error?: string;
// }

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
