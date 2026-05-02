// // ============================================================
// // api.types.ts — Shared API response envelope types
// // ============================================================

// export interface ApiSuccess<T> {
//   success: true;
//   data: T;
// }

// export interface ApiError {
//   success: false;
//   error: {
//     code: string;
//     message: string;
//     details?: unknown;
//   };
// }

// export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// // ---- Admin data response ----

// export interface AdminStats {
//   totalInquiries: number;
//   pendingInquiries: number;
//   scheduledAppointments: number;
//   totalTherapists: number;
// }

// export interface AdminDataResponse {
//   stats: AdminStats;
//   inquiries: InquiryRow[];
//   appointments: AppointmentRow[];
// }

// export interface InquiryRow {
//   id: string;
//   patient_identifier: string | null;
//   problem_description: string;
//   requested_schedule: string | null;
//   insurance_info: string | null;
//   extracted_specialty: string | null;
//   status: string;
//   created_at: string;
//   matched_therapist_id: string | null;
//   therapist?: { name: string };
// }

// export interface AppointmentRow {
//   id: string;
//   inquiry_id: string;
//   therapist_id: string;
//   patient_identifier: string | null;
//   start_time: string;
//   end_time: string;
//   status: string;
//   created_at: string;
//   therapist?: { name: string };
// }
// ============================================================
// api.types.ts — Shared API response envelope types
// CHANGE: Added TherapistRow, fixed AdminStats to match backend,
//         added patient_identifier to AppointmentRow, added
//         therapists array to AdminDataResponse.
// ============================================================

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ---- Admin stats ----

export interface AdminStats {
  totalInquiries: number;
  pendingInquiries: number;
  scheduledAppointments: number;
  totalTherapists: number;
  byStatus?: Record<string, number>;
}

// ---- Therapist row (from therapists table) ----

export interface TherapistRow {
  id: string;
  name: string;
  specialties: string[];
  accepted_insurance: string[];
  bio: string | null;
  avatar_url: string | null;
  google_calendar_id: string | null;
  created_at: string;
}

// ---- Admin data response ----

export interface AdminDataResponse {
  stats: AdminStats;
  inquiries: InquiryRow[];
  appointments: AppointmentRow[];
  therapists: TherapistRow[];
}

// ---- Inquiry row ----

export interface InquiryRow {
  id: string;
  patient_identifier: string | null;
  problem_description: string;
  extracted_conditions?: string[];
  primary_specialty?: string | null;
  requested_schedule: string | null;
  insurance_info: string | null;
  status: string;
  raw_chat_summary?: string | null;
  created_at: string;
  matched_therapist_id?: string | null;
  therapists?:
    | { id: string; name: string }
    | { id: string; name: string }[]
    | null;
}

// ---- Appointment row ----

export interface AppointmentRow {
  id: string;
  inquiry_id?: string;
  therapist_id?: string;
  patient_identifier: string | null;
  start_time: string;
  end_time: string;
  status: string;
  appointment_type?: string;
  google_calendar_event_id?: string | null;
  admin_notes?: string | null;
  created_at: string;
  therapists?:
    | { id: string; name: string; email?: string }
    | { id: string; name: string; email?: string }[]
    | null;
}
