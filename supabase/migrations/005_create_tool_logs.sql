-- -- =============================================================================
-- -- Migration 005: Create tool_call_logs table
-- -- =============================================================================
-- -- Every time the agent executes a tool, we write one row here. This gives us:
-- --   1. Full audit trail — who did what, when, with what data
-- --   2. Performance monitoring — which tools are slow (Google Calendar calls?)
-- --   3. Debugging — exact inputs/outputs for every failed booking attempt
-- --   4. Analytics — which conditions are most common, which tools fail most
-- --
-- -- This table is append-only — rows are NEVER updated or deleted during normal
-- -- operation. Archival/deletion is a future concern (data retention policy).
-- --
-- -- Design decisions:
-- --   - input_params and output_result are JSONB so we can store any tool's
-- --     arbitrary input/output shape without schema changes.
-- --   - error_code and error_message are separate columns (not just inside
-- --     output_result JSONB) so we can index and query errors efficiently.
-- --   - duration_ms lets us run percentile queries to find slow tools.
-- --   - gemini_turn_index tracks which turn in the conversation triggered this
-- --     tool call (for reconstructing the full agent decision sequence).
-- -- =============================================================================

-- BEGIN;

-- DO $$
-- BEGIN
--   IF NOT EXISTS (
--     SELECT 1 FROM information_schema.tables
--     WHERE table_schema = 'public'
--     AND table_name = 'tool_call_logs'
--   ) THEN

--     IF NOT EXISTS (
--       SELECT 1 FROM information_schema.tables
--       WHERE table_schema = 'public' AND table_name = 'conversation_sessions'
--     ) THEN
--       RAISE EXCEPTION '[005] conversation_sessions must exist before tool_call_logs — run 004 first';
--     END IF;

--     CREATE TABLE public.tool_call_logs (
--       -- Primary key — auto-incrementing bigint for efficient time-ordered scans
--       id                    BIGSERIAL     PRIMARY KEY,

--       -- Session this tool call belongs to
--       session_id            UUID          NOT NULL REFERENCES public.conversation_sessions(id) ON DELETE CASCADE,

--       -- Which turn in the conversation triggered this tool call (0-indexed)
--       -- Lets us group all tool calls from one agent loop iteration
--       gemini_turn_index     INTEGER       NOT NULL DEFAULT 0,

--       -- Tool identification
--       -- Must match exactly one registered tool name in toolRegistry
--       tool_name             TEXT          NOT NULL CHECK (tool_name IN (
--                               'extractPatientInfo',
--                               'saveInquiry',
--                               'findMatchingTherapists',
--                               'checkAvailability',
--                               'bookAppointment',
--                               'updateInquiryStatus',
--                               'getTherapistProfile',
--                               'sendConfirmation'
--                             )),

--       -- Input parameters passed to the tool by Gemini (functionCall.args)
--       input_params          JSONB         NOT NULL DEFAULT '{}'::JSONB,

--       -- Output returned to Gemini (functionResponse.response)
--       output_result         JSONB,

--       -- Success tracking
--       success               BOOLEAN       NOT NULL DEFAULT false,

--       -- Error details (populated only when success = false)
--       error_code            TEXT,         -- e.g. 'CALENDAR_UNAVAILABLE', 'DB_WRITE_FAILED'
--       error_message         TEXT,

--       -- Performance
--       duration_ms           INTEGER       CHECK (duration_ms >= 0),

--       -- Timestamp (no updated_at — this table is append-only)
--       called_at             TIMESTAMPTZ   NOT NULL DEFAULT NOW()
--     );

--     -- Primary access pattern: get all tool calls for a session (debugging)
--     CREATE INDEX idx_tool_logs_session
--       ON public.tool_call_logs (session_id, called_at ASC);

--     -- Analytics: which tools fail most often?
--     CREATE INDEX idx_tool_logs_name_success
--       ON public.tool_call_logs (tool_name, success);

--     -- Performance monitoring: slow tool calls
--     CREATE INDEX idx_tool_logs_duration
--       ON public.tool_call_logs (duration_ms DESC)
--       WHERE duration_ms IS NOT NULL;

--     -- Error investigation: recent failures
--     CREATE INDEX idx_tool_logs_errors
--       ON public.tool_call_logs (called_at DESC)
--       WHERE success = false;

--     -- JSONB index for querying specific input patterns
--     -- e.g. find all calls where insurance was 'aetna'
--     CREATE INDEX idx_tool_logs_input_gin
--       ON public.tool_call_logs USING GIN (input_params jsonb_path_ops);

--     RAISE NOTICE '[005] tool_call_logs table created successfully';

--   ELSE
--     RAISE NOTICE '[005] tool_call_logs table already exists — skipping';
--   END IF;
-- END $$;

-- COMMIT;

-- =============================================================================
-- Migration 005: Create tool_call_logs table
-- =============================================================================
-- Every time the agent executes a tool, we write one row here. This gives us:
--   1. Full audit trail — who did what, when, with what data
--   2. Performance monitoring — which tools are slow (Google Calendar calls?)
--   3. Debugging — exact inputs/outputs for every failed booking attempt
--   4. Analytics — which conditions are most common, which tools fail most
--
-- This table is append-only — rows are NEVER updated or deleted during normal
-- operation. Archival/deletion is a future concern (data retention policy).
--
-- Design decisions:
--   - input_params and output_result are JSONB so we can store any tool's
--     arbitrary input/output shape without schema changes.
--   - error_code and error_message are separate columns (not just inside
--     output_result JSONB) so we can index and query errors efficiently.
--   - duration_ms lets us run percentile queries to find slow tools.
--   - gemini_turn_index tracks which turn in the conversation triggered this
--     tool call (for reconstructing the full agent decision sequence).
-- =============================================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'tool_call_logs'
  ) THEN

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'conversation_sessions'
    ) THEN
      RAISE EXCEPTION '[005] conversation_sessions must exist before tool_call_logs — run 004 first';
    END IF;

    CREATE TABLE public.tool_call_logs (
      -- Primary key — auto-incrementing bigint for efficient time-ordered scans
      id                    BIGSERIAL     PRIMARY KEY,

      -- Session this tool call belongs to
      session_id            UUID          NOT NULL REFERENCES public.conversation_sessions(id) ON DELETE CASCADE,

      -- Which turn in the conversation triggered this tool call (0-indexed)
      -- Lets us group all tool calls from one agent loop iteration
      gemini_turn_index     INTEGER       NOT NULL DEFAULT 0,

      -- Tool identification
      -- No CHECK constraint here intentionally — violates OCP.
      -- Adding a new tool would require a migration to update the constraint.
      -- Validation happens at the application layer (toolRegistry) instead.
      tool_name             TEXT          NOT NULL CHECK (char_length(tool_name) > 0),

      -- Input parameters passed to the tool by Gemini (functionCall.args)
      input_params          JSONB         NOT NULL DEFAULT '{}'::JSONB,

      -- Output returned to Gemini (functionResponse.response)
      output_result         JSONB,

      -- Success tracking
      success               BOOLEAN       NOT NULL DEFAULT false,

      -- Error details (populated only when success = false)
      error_code            TEXT,         -- e.g. 'CALENDAR_UNAVAILABLE', 'DB_WRITE_FAILED'
      error_message         TEXT,

      -- Performance
      duration_ms           INTEGER       CHECK (duration_ms >= 0),

      -- Timestamp (no updated_at — this table is append-only)
      called_at             TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    );

    -- Primary access pattern: get all tool calls for a session (debugging)
    CREATE INDEX idx_tool_logs_session
      ON public.tool_call_logs (session_id, called_at ASC);

    -- Analytics: which tools fail most often?
    CREATE INDEX idx_tool_logs_name_success
      ON public.tool_call_logs (tool_name, success);

    -- Performance monitoring: slow tool calls
    CREATE INDEX idx_tool_logs_duration
      ON public.tool_call_logs (duration_ms DESC)
      WHERE duration_ms IS NOT NULL;

    -- Error investigation: recent failures
    CREATE INDEX idx_tool_logs_errors
      ON public.tool_call_logs (called_at DESC)
      WHERE success = false;

    -- JSONB index for querying specific input patterns
    -- e.g. find all calls where insurance was 'aetna'
    CREATE INDEX idx_tool_logs_input_gin
      ON public.tool_call_logs USING GIN (input_params jsonb_path_ops);

    RAISE NOTICE '[005] tool_call_logs table created successfully';

  ELSE
    RAISE NOTICE '[005] tool_call_logs table already exists — skipping';
  END IF;
END $$;

COMMIT;