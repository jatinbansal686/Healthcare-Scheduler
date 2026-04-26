-- =============================================================================
-- Migration 003: Create appointments table
-- =============================================================================
-- An appointment is the confirmed outcome of a successful inquiry. It is created
-- by the bookAppointment tool atomically alongside the Google Calendar event.
-- If the Calendar API call fails, this row is NOT inserted (handled in the tool
-- layer using a try/catch + rollback pattern).
--
-- Design decisions:
--   - google_calendar_event_id links back to the Calendar event for cancellation,
--     rescheduling, and verification.
--   - start_time / end_time are stored with timezone in TIMESTAMPTZ so we never
--     have ambiguous local-time issues.
--   - status mirrors the inquiry status machine but is appointment-specific:
--       confirmed → the happy path
--       cancelled_by_patient / cancelled_by_therapist → for analytics
--       completed → post-appointment flag (can be set by a future admin action)
--       no_show → patient did not attend
--   - meeting_link is for future telehealth support (Google Meet, Zoom URL).
-- =============================================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'appointments'
  ) THEN

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'inquiries'
    ) THEN
      RAISE EXCEPTION '[003] inquiries table must exist before appointments — run 002 first';
    END IF;

    CREATE TABLE public.appointments (
      -- Primary key
      id                          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),

      -- Foreign keys — both required, never nullable on a real appointment
      inquiry_id                  UUID          NOT NULL REFERENCES public.inquiries(id) ON DELETE CASCADE,
      therapist_id                UUID          NOT NULL REFERENCES public.therapists(id) ON DELETE RESTRICT,

      -- Patient reference (same format as inquiries.patient_identifier)
      patient_identifier          TEXT          NOT NULL,

      -- Appointment time window (always stored in UTC via TIMESTAMPTZ)
      start_time                  TIMESTAMPTZ   NOT NULL,
      end_time                    TIMESTAMPTZ   NOT NULL,

      -- Derived constraint: end must be after start
      CONSTRAINT appointments_time_order CHECK (end_time > start_time),

      -- Duration sanity check: between 15 minutes and 3 hours
      CONSTRAINT appointments_duration_check CHECK (
        EXTRACT(EPOCH FROM (end_time - start_time)) BETWEEN 900 AND 10800
      ),

      -- Google Calendar integration
      google_calendar_event_id    TEXT          UNIQUE,  -- null if calendar booking failed
      google_meet_link            TEXT,                  -- populated if therapist has Meet enabled

      -- Appointment type (individual, couples, group — for future expansion)
      appointment_type            TEXT          NOT NULL DEFAULT 'individual'
                                  CHECK (appointment_type IN ('individual', 'couples', 'group', 'family')),

      -- Status state machine:
      --   confirmed             → booked and active
      --   cancelled_by_patient  → patient cancelled via chat or admin
      --   cancelled_by_therapist → therapist or admin cancelled
      --   completed             → appointment happened (set by admin action)
      --   no_show               → patient did not attend
      --   rescheduled           → replaced by a new appointment row
      status                      TEXT          NOT NULL DEFAULT 'confirmed'
                                  CHECK (status IN (
                                    'confirmed',
                                    'cancelled_by_patient',
                                    'cancelled_by_therapist',
                                    'completed',
                                    'no_show',
                                    'rescheduled'
                                  )),

      -- If rescheduled, this points to the replacement appointment
      rescheduled_to_id           UUID          REFERENCES public.appointments(id) ON DELETE SET NULL,

      -- Admin notes (never shown to patient)
      admin_notes                 TEXT          CHECK (char_length(admin_notes) <= 1000),

      -- Audit
      created_at                  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at                  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    );

    -- Prevent double-booking: a therapist cannot have two confirmed appointments
    -- that overlap in time. This is a partial unique index using an exclusion constraint.
    -- Requires btree_gist extension.
    CREATE EXTENSION IF NOT EXISTS btree_gist;

    ALTER TABLE public.appointments
      ADD CONSTRAINT appointments_no_overlap
      EXCLUDE USING gist (
        therapist_id WITH =,
        tstzrange(start_time, end_time) WITH &&
      )
      WHERE (status = 'confirmed');

    -- Query indexes
    CREATE INDEX idx_appointments_therapist_time
      ON public.appointments (therapist_id, start_time DESC);

    CREATE INDEX idx_appointments_inquiry
      ON public.appointments (inquiry_id);

    CREATE INDEX idx_appointments_status
      ON public.appointments (status, created_at DESC);

    CREATE INDEX idx_appointments_patient
      ON public.appointments (patient_identifier);

    -- Index for upcoming appointments query (admin dashboard)
    CREATE INDEX idx_appointments_upcoming
  ON public.appointments (start_time ASC)
  WHERE status = 'confirmed';

    CREATE TRIGGER appointments_updated_at
      BEFORE UPDATE ON public.appointments
      FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

    RAISE NOTICE '[003] appointments table created successfully';

  ELSE
    RAISE NOTICE '[003] appointments table already exists — skipping';
  END IF;
END $$;

COMMIT;