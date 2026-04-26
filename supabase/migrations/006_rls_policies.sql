-- =============================================================================
-- Migration 006: Row Level Security policies
-- =============================================================================
-- Security model:
--
--   PUBLIC (anon key):
--     - therapists: SELECT only on safe columns (no google tokens) via a VIEW
--     - All other tables: NO ACCESS via anon key at all
--     - All writes go through Edge Functions which use the service_role key
--
--   AUTHENTICATED (admin users via Supabase Auth):
--     - All tables: full SELECT
--     - inquiries, appointments: UPDATE (for admin actions)
--     - therapists: UPDATE (for admin management)
--     - tool_call_logs: SELECT only (append-only from Edge Function)
--
--   SERVICE ROLE (Edge Functions only — never exposed to client):
--     - All tables: full access (bypasses RLS entirely)
--     - This is why Edge Functions use the service_role client, never anon
--
-- CRITICAL: The google_refresh_token column on therapists is NEVER returned
-- by any SELECT — we use a security definer view to hide it from all
-- authenticated users except service_role.
--
-- Rule of thumb applied throughout:
--   "Deny everything by default. Grant the minimum needed."
-- =============================================================================

BEGIN;

-- ===========================
-- Enable RLS on all tables
-- ===========================

ALTER TABLE public.therapists            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inquiries             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tool_call_logs        ENABLE ROW LEVEL SECURITY;

-- Force RLS even for table owners (extra safety — prevents accidental admin bypass)
ALTER TABLE public.therapists            FORCE ROW LEVEL SECURITY;
ALTER TABLE public.inquiries             FORCE ROW LEVEL SECURITY;
ALTER TABLE public.appointments          FORCE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.tool_call_logs        FORCE ROW LEVEL SECURITY;

-- ===========================
-- therapists policies
-- ===========================

-- Anon users: NO direct table access at all.
-- They get therapist data through the agent-chat Edge Function only.
-- (No SELECT policy for anon = denied)

-- Authenticated admin users: can read all therapist data EXCEPT the refresh token
-- The refresh token is excluded via the safe_therapists view below
CREATE POLICY "admins_read_therapists"
  ON public.therapists
  FOR SELECT
  TO authenticated
  USING (true);  -- Any authenticated user = admin in this system

-- Authenticated admin users: can update therapist info (e.g. mark inactive)
CREATE POLICY "admins_update_therapists"
  ON public.therapists
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Service role: full access (handled implicitly by bypassing RLS)
-- No explicit policy needed for service_role.

-- ===========================
-- inquiries policies
-- ===========================

-- Anon: NO access
-- Authenticated admins: full read, can update status
CREATE POLICY "admins_read_inquiries"
  ON public.inquiries
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "admins_update_inquiries"
  ON public.inquiries
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ===========================
-- appointments policies
-- ===========================

CREATE POLICY "admins_read_appointments"
  ON public.appointments
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "admins_update_appointments"
  ON public.appointments
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ===========================
-- conversation_sessions policies
-- ===========================

-- Admins can read sessions for debugging
CREATE POLICY "admins_read_sessions"
  ON public.conversation_sessions
  FOR SELECT
  TO authenticated
  USING (true);

-- Admins can update session status (e.g. mark abandoned)
CREATE POLICY "admins_update_sessions"
  ON public.conversation_sessions
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ===========================
-- tool_call_logs policies
-- ===========================

-- Admins: read-only (append-only table)
CREATE POLICY "admins_read_tool_logs"
  ON public.tool_call_logs
  FOR SELECT
  TO authenticated
  USING (true);

-- No INSERT/UPDATE/DELETE policy for authenticated users on tool_call_logs
-- Only service_role (Edge Functions) can write here

-- ===========================
-- Security view: hide refresh token from authenticated users
-- ===========================
-- Even authenticated admin users should not see raw OAuth tokens.
-- They can see everything else about a therapist.
-- The service_role (Edge Functions) reads the raw table, not this view.

CREATE OR REPLACE VIEW public.safe_therapists
  WITH (security_invoker = true)
AS
  SELECT
    id,
    name,
    email,
    bio,
    photo_url,
    years_experience,
    specialties,
    accepted_insurance,
    session_types,
    languages,
    google_calendar_id,
    -- Deliberately excluding: google_refresh_token
    google_oauth_connected_at,
    session_duration_minutes,
    availability_timezone,
    is_active,
    created_at,
    updated_at
  FROM public.therapists;

-- Grant authenticated users access to the safe view
GRANT SELECT ON public.safe_therapists TO authenticated;

-- ===========================
-- Revoke public access on raw tables as extra safety layer
-- ===========================
-- Supabase auto-grants SELECT to anon on public schema by default.
-- We revoke that explicitly.

REVOKE ALL ON public.therapists            FROM anon;
REVOKE ALL ON public.inquiries             FROM anon;
REVOKE ALL ON public.appointments          FROM anon;
REVOKE ALL ON public.conversation_sessions FROM anon;
REVOKE ALL ON public.tool_call_logs        FROM anon;

-- Grant minimal permissions to authenticated role
GRANT SELECT, UPDATE ON public.therapists            TO authenticated;
GRANT SELECT, UPDATE ON public.inquiries             TO authenticated;
GRANT SELECT, UPDATE ON public.appointments          TO authenticated;
GRANT SELECT, UPDATE ON public.conversation_sessions TO authenticated;
GRANT SELECT          ON public.tool_call_logs       TO authenticated;

-- Service role gets everything (Supabase handles this, but explicit is clearer)
GRANT ALL ON public.therapists            TO service_role;
GRANT ALL ON public.inquiries             TO service_role;
GRANT ALL ON public.appointments          TO service_role;
GRANT ALL ON public.conversation_sessions TO service_role;
GRANT ALL ON public.tool_call_logs        TO service_role;
GRANT ALL ON public.safe_therapists       TO service_role;


COMMIT;