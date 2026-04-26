// ============================================================
// therapist.types.ts — Domain types for therapist entities
// ============================================================

export interface Therapist {
  id: string;
  name: string;
  specialties: string[];
  accepted_insurance: string[];
  google_calendar_id: string | null;
  bio: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface TherapistAvailabilitySlot {
  start: string; // ISO 8601
  end: string;   // ISO 8601
}

export interface TherapistWithAvailability extends Therapist {
  availableSlots: TherapistAvailabilitySlot[];
}

export interface TherapistMatch {
  therapist: Therapist;
  matchScore: number; // 0–1
  matchedSpecialties: string[];
  insuranceAccepted: boolean;
}