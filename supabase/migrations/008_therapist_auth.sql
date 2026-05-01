-- ============================================================
-- 008_therapist_auth.sql
-- Links Supabase auth.users to therapists table
-- Adds confirmation_token + pending timeout fields to appointments
-- ============================================================

-- 1. Link auth user to therapist row
ALTER TABLE public.therapists
  ADD COLUMN IF NOT EXISTS auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Add confirmation token (for email link confirmation — no login required)
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS confirmation_token uuid UNIQUE DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS confirmation_token_expires_at timestamp with time zone
    DEFAULT (now() + interval '24 hours'),
  ADD COLUMN IF NOT EXISTS therapist_action_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS therapist_rejection_reason text;

-- 3. Update appointments status CHECK to include 'pending'
-- (Drop old constraint, re-add with 'pending' included)
ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_status_check;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_status_check
    CHECK (status = ANY (ARRAY[
      'pending'::text,
      'confirmed'::text,
      'cancelled_by_patient'::text,
      'cancelled_by_therapist'::text,
      'completed'::text,
      'no_show'::text,
      'rescheduled'::text
    ]));

-- 4. Index for fast token lookup (used in therapist-action function)
CREATE INDEX IF NOT EXISTS idx_appointments_confirmation_token
  ON public.appointments(confirmation_token);

-- 5. Index for therapist dashboard queries
CREATE INDEX IF NOT EXISTS idx_appointments_therapist_status
  ON public.appointments(therapist_id, status);

-- 6. RLS: therapists can read/update their own appointments via auth_user_id
-- Allow therapists to view their appointments (authenticated)
CREATE POLICY IF NOT EXISTS "Therapists can view own appointments"
  ON public.appointments
  FOR SELECT
  TO authenticated
  USING (
    therapist_id IN (
      SELECT id FROM public.therapists
      WHERE auth_user_id = auth.uid()
    )
  );

-- Allow therapists to update status on their own appointments
CREATE POLICY IF NOT EXISTS "Therapists can update own appointment status"
  ON public.appointments
  FOR UPDATE
  TO authenticated
  USING (
    therapist_id IN (
      SELECT id FROM public.therapists
      WHERE auth_user_id = auth.uid()
    )
  );

-- Allow service role to update appointments (for token-based confirmation)
-- (Service role bypasses RLS — no policy needed)