// ============================================================
// api.types.ts — Shared API response envelope types
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

// ---- Admin data response ----

export interface AdminStats {
  totalInquiries: number;
  pendingInquiries: number;
  scheduledAppointments: number;
  totalTherapists: number;
}

export interface AdminDataResponse {
  stats: AdminStats;
  inquiries: InquiryRow[];
  appointments: AppointmentRow[];
}

export interface InquiryRow {
  id: string;
  patient_identifier: string | null;
  problem_description: string;
  requested_schedule: string | null;
  insurance_info: string | null;
  extracted_specialty: string | null;
  status: string;
  created_at: string;
  matched_therapist_id: string | null;
  therapist?: { name: string };
}

export interface AppointmentRow {
  id: string;
  inquiry_id: string;
  therapist_id: string;
  patient_identifier: string | null;
  start_time: string;
  end_time: string;
  status: string;
  created_at: string;
  therapist?: { name: string };
}