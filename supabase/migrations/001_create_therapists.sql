-- =============================================================================
-- Migration 001: Create therapists table
-- =============================================================================
-- This is the core entity table. Each row represents one therapist in the system.
--
-- Design decisions:
--   - specialties and accepted_insurance are TEXT[] (PostgreSQL arrays) so we can
--     query using array operators (@>, &&) without a join table. For a prototype
--     this is simpler and fast enough. If specialties grow to hundreds of values,
--     a separate join table would be better — add that as a future migration.
--   - google_refresh_token is stored as TEXT here but should be encrypted via
--     Supabase Vault in production. Migration 006 (RLS) will lock this column
--     down so it is never readable via the anon key.
--   - is_active lets us soft-delete therapists without breaking FK references
--     in inquiries and appointments.
--   - availability_timezone ensures we interpret Google Calendar slots correctly
--     for therapists in different time zones.
-- =============================================================================

BEGIN;

-- Safety check: only run if table does not already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'therapists'
  ) THEN

    CREATE TABLE public.therapists (
      -- Primary key
      id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),

      -- Identity
      name                  TEXT          NOT NULL CHECK (char_length(name) BETWEEN 2 AND 100),
      email                 TEXT          NOT NULL UNIQUE CHECK (email ~* '^[^@]+@[^@]+\.[^@]+$'),
      bio                   TEXT          NOT NULL DEFAULT '' CHECK (char_length(bio) <= 2000),
      photo_url             TEXT          CHECK (photo_url IS NULL OR photo_url ~* '^https?://'),
      years_experience      INTEGER       CHECK (years_experience IS NULL OR years_experience >= 0),

      -- Clinical matching fields — these are what the AI agent queries against
      -- Example: specialties = ARRAY['anxiety','depression','trauma','PTSD']
      specialties           TEXT[]        NOT NULL DEFAULT '{}',
      -- Example: accepted_insurance = ARRAY['aetna','bluecross','united','cigna']
      accepted_insurance    TEXT[]        NOT NULL DEFAULT '{}',
      -- Session types offered
      session_types         TEXT[]        NOT NULL DEFAULT ARRAY['individual'],
      -- Languages spoken (for future multilingual matching)
      languages             TEXT[]        NOT NULL DEFAULT ARRAY['english'],

      -- Google Calendar integration
      -- google_calendar_id is typically the therapist's Gmail address
      google_calendar_id    TEXT          UNIQUE,
      -- WARNING: Store the actual refresh token in Supabase Vault.
      -- This column holds the Vault secret reference key, not the raw token.
      -- During prototype phase we store the raw token here and lock it with RLS.
      google_refresh_token  TEXT,
      -- Track when the OAuth connection was last established
      google_oauth_connected_at TIMESTAMPTZ,

      -- Scheduling config
      -- Typical session length in minutes (30, 45, 50, 60, 90)
      session_duration_minutes INTEGER   NOT NULL DEFAULT 50 CHECK (session_duration_minutes > 0),
      -- IANA timezone string e.g. 'America/Chicago'
      availability_timezone  TEXT        NOT NULL DEFAULT 'America/Chicago',

      -- Status
      is_active             BOOLEAN       NOT NULL DEFAULT true,

      -- Audit
      created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    );

    -- Index for the most common agent query: find therapists by specialty + insurance
    -- The agent calls findMatchingTherapists with these two filters every session
    CREATE INDEX idx_therapists_specialties
      ON public.therapists USING GIN (specialties);

    CREATE INDEX idx_therapists_insurance
      ON public.therapists USING GIN (accepted_insurance);

    -- Composite index for active therapists only (most queries filter is_active = true)
    CREATE INDEX idx_therapists_active
      ON public.therapists (is_active)
      WHERE is_active = true;

    -- Auto-update updated_at on any row change
    CREATE OR REPLACE FUNCTION public.handle_updated_at()
    RETURNS TRIGGER AS $trigger$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $trigger$ LANGUAGE plpgsql;

    CREATE TRIGGER therapists_updated_at
      BEFORE UPDATE ON public.therapists
      FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

    RAISE NOTICE '[001] therapists table created successfully';

  ELSE
    RAISE NOTICE '[001] therapists table already exists — skipping';
  END IF;
END $$;

COMMIT;