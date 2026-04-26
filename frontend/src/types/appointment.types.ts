// ============================================================
// appointment.types.ts — Domain types for appointment entities
// ============================================================

export type AppointmentStatus = 'confirmed' | 'cancelled' | 'pending' | 'completed';

export interface Appointment {
  id: string;
  inquiry_id: string;
  therapist_id: string;
  patient_identifier: string | null;
  start_time: string;
  end_time: string;
  google_calendar_event_id: string | null;
  status: AppointmentStatus;
  created_at: string;
  // Joined fields from admin queries
  therapist?: { name: string };
}

export interface BookAppointmentRequest {
  inquiry_id: string;
  therapist_id: string;
  patient_identifier: string;
  start_time: string;
  end_time: string;
}