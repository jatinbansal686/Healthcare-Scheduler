-- =============================================================================
-- Migration 004: Create conversation_sessions table
-- =============================================================================
-- This table is what makes the agent genuinely multi-turn. Instead of sending
-- a re-summarized chat log to the LLM each turn, we persist the FULL Gemini
-- message array (including all tool call inputs and outputs) and replay it on
-- every subsequent turn.
--
-- This means:
--   - The agent always has the exact same context it would have in a long-running
--     process — no information loss between HTTP requests.
--   - Tool results from previous turns are visible to the LLM in future turns
--     (e.g. "we already found Dr. Rivera is available" is in the message history).
--   - Admin can inspect the exact messages array for debugging.
--
-- Design decisions:
--   - messages is JSONB — the full Gemini Content[] array. We store it as-is
--     from the SDK response so we can replay it without transformation.
--   - tool_call_summary is a denormalized JSONB array of { toolName, success, durationMs }
--     for quick admin analytics without joining tool_call_logs.
--   - session_state is a JSONB bag for any extra state the orchestrator needs
--     to carry between turns (e.g. which therapists have been checked).
--   - expires_at lets us clean up old sessions with a pg_cron job later.
-- =============================================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'conversation_sessions'
  ) THEN

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'inquiries'
    ) THEN
      RAISE EXCEPTION '[004] inquiries table must exist before conversation_sessions — run 002 first';
    END IF;

    CREATE TABLE public.conversation_sessions (
      -- Primary key — this is also used as the session token passed between
      -- frontend and backend on each message
      id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),

      -- Link to the inquiry this session is working on.
      -- NULL means the session is in the pre-inquiry phase (collecting patient info).
      inquiry_id            UUID          REFERENCES public.inquiries(id) ON DELETE SET NULL,

      -- The full Gemini message array — Content[] from the Google AI SDK.
      -- Structure: [{ role: 'user'|'model', parts: [{ text }|{ functionCall }|{ functionResponse }] }]
      -- This is replayed verbatim on each subsequent turn.
      messages              JSONB         NOT NULL DEFAULT '[]'::JSONB,

      -- Denormalized tool summary for quick admin analytics
      -- Structure: [{ toolName, success, durationMs, calledAt }]
      tool_call_summary     JSONB         NOT NULL DEFAULT '[]'::JSONB,

      -- Arbitrary state bag for the orchestrator
      -- Example: { checkedTherapistIds: ['uuid1'], lastExtractedConditions: ['anxiety'] }
      session_state         JSONB         NOT NULL DEFAULT '{}'::JSONB,

      -- How many turns (user messages) this session has processed
      turn_count            INTEGER       NOT NULL DEFAULT 0,

      -- Total tool calls executed across all turns
      total_tool_calls      INTEGER       NOT NULL DEFAULT 0,

      -- Session outcome tracking
      -- active       → session in progress
      -- completed    → appointment booked, session done
      -- abandoned    → patient left without booking
      -- error        → agent hit an unrecoverable error
      session_status        TEXT          NOT NULL DEFAULT 'active'
                            CHECK (session_status IN ('active', 'completed', 'abandoned', 'error')),

      -- Patient identifier (same format as inquiries — anonymized)
      -- Stored here so we can query sessions by patient before inquiry is created
      patient_identifier    TEXT,

      -- Session expiry — active sessions expire after 24 hours of inactivity
      -- A background job or the agent-chat function should check this
      expires_at            TIMESTAMPTZ   NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),

      -- Audit
      created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    );

    -- Primary access pattern: load session by ID on each incoming message
    -- (already covered by PK index)

    -- Admin dashboard: sessions by status and recency
    CREATE INDEX idx_sessions_status
      ON public.conversation_sessions (session_status, created_at DESC);

    -- Link sessions to inquiries
    CREATE INDEX idx_sessions_inquiry
      ON public.conversation_sessions (inquiry_id)
      WHERE inquiry_id IS NOT NULL;

    -- Cleanup query: find expired active sessions
    CREATE INDEX idx_sessions_expires
      ON public.conversation_sessions (expires_at)
      WHERE session_status = 'active';

    -- JSONB path index on messages array for debugging queries
    -- e.g. SELECT * FROM sessions WHERE messages @> '[{"role":"model"}]'
    CREATE INDEX idx_sessions_messages_gin
      ON public.conversation_sessions USING GIN (messages jsonb_path_ops);

    CREATE TRIGGER sessions_updated_at
      BEFORE UPDATE ON public.conversation_sessions
      FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

    RAISE NOTICE '[004] conversation_sessions table created successfully';

  ELSE
    RAISE NOTICE '[004] conversation_sessions table already exists — skipping';
  END IF;
END $$;

COMMIT;