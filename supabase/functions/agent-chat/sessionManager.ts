import type {
  ConversationSessionRow,
  GeminiMessage,
  SessionState,
  SessionStatus,
  ToolCallSummaryEntry,
} from "../_shared/types.ts";
import { getSupabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { createLogger } from "../_shared/logger.ts";
import { SessionError } from "../_shared/error.ts";

const logger = createLogger("SessionManager");

// Max messages before we trim to avoid Gemini token limits
const MAX_MESSAGES_BEFORE_TRIM = 60;

export class SessionManager {
  private readonly supabase = getSupabaseAdmin();

  // ── Load or create a session ──────────────────────────────

  async getOrCreateSession(
    sessionId: string,
    patientIdentifier: string,
  ): Promise<ConversationSessionRow> {
    logger.info("getOrCreateSession called", { sessionId, patientIdentifier });

    try {
      logger.db("Looking up existing session", { sessionId });

      const { data: existing, error: fetchError } = await this.supabase
        .from("conversation_sessions")
        .select("*")
        .eq("id", sessionId)
        .maybeSingle();

      if (fetchError) {
        logger.error("Error fetching session from DB", {
          sessionId,
          error: fetchError.message,
          code: fetchError.code,
        });
        throw new SessionError(
          `Failed to fetch session: ${fetchError.message}`,
        );
      }

      if (existing) {
        logger.info("Existing session found", {
          sessionId,
          messageCount: existing.messages?.length ?? 0,
          turnCount: existing.turn_count ?? 0,
          sessionStatus: existing.session_status,
        });
        return existing as ConversationSessionRow;
      }

      logger.info("No existing session — creating new one", { sessionId });
      return await this.createSession(sessionId, patientIdentifier);
    } catch (err) {
      if (err instanceof SessionError) throw err;
      logger.error("Unexpected error in getOrCreateSession", {
        sessionId,
        err,
      });
      throw new SessionError(
        `Session operation failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // ── Create a brand-new session ────────────────────────────

  private async createSession(
    sessionId: string,
    patientIdentifier: string,
  ): Promise<ConversationSessionRow> {
    logger.db("Creating new conversation session", {
      sessionId,
      patientIdentifier,
    });

    // Initial session_state — matches SessionState interface in types.ts
    const initialSessionState: SessionState = {
      patientName: null,
      extractedConditions: [],
      extractedInsurance: null,
      extractedSchedule: null,
      matchedTherapistId: null,
      checkedTherapistIds: [],
      presentedSlots: [],
      appointmentBooked: false,
      bookedInquiryId: null,
      lastToolUsed: null,
    };

    const { data, error } = await this.supabase
      .from("conversation_sessions")
      .insert({
        id: sessionId,
        patient_identifier: patientIdentifier,
        messages: [],
        // DB column is session_state — NOT "metadata"
        session_state: initialSessionState,
        tool_call_summary: [],
        turn_count: 0,
        total_tool_calls: 0,
        session_status: "active" satisfies SessionStatus,
        inquiry_id: null,
      })
      .select("*")
      .single();

    if (error) {
      logger.error("Failed to create session in DB", {
        sessionId,
        error: error.message,
        code: error.code,
      });
      throw new SessionError(`Failed to create session: ${error.message}`);
    }

    logger.info("New session created successfully", { sessionId: data.id });
    return data as ConversationSessionRow;
  }

  // ── Persist updated message history and state ─────────────

  async saveSession(
    sessionId: string,
    messages: GeminiMessage[],
    sessionState: Partial<SessionState>,
  ): Promise<void> {
    logger.db("Saving session", {
      sessionId,
      messageCount: messages.length,
    });

    // Trim if message history is getting very long
    const messagesToSave =
      messages.length > MAX_MESSAGES_BEFORE_TRIM
        ? this.trimMessages(messages)
        : messages;

    const { error } = await this.supabase
      .from("conversation_sessions")
      .update({
        messages: messagesToSave,
        // DB column is session_state — NOT "metadata"
        session_state: sessionState,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId);

    if (error) {
      logger.error("Failed to save session to DB", {
        sessionId,
        error: error.message,
        code: error.code,
      });
      throw new SessionError(`Failed to save session: ${error.message}`);
    }

    logger.db("Session saved successfully", {
      sessionId,
      savedMessageCount: messagesToSave.length,
    });
  }

  // ── Mark session as completed / abandoned / error ─────────

  async updateSessionStatus(
    sessionId: string,
    status: SessionStatus,
  ): Promise<void> {
    logger.db("Updating session status", { sessionId, status });

    const { error } = await this.supabase
      .from("conversation_sessions")
      .update({ session_status: status })
      .eq("id", sessionId);

    if (error) {
      logger.warn("Failed to update session status (non-fatal)", {
        sessionId,
        status,
        error: error.message,
      });
    }
  }

  // ── Link session to its created inquiry ───────────────────

  async linkSessionToInquiry(
    sessionId: string,
    inquiryId: string,
  ): Promise<void> {
    logger.db("Linking session to inquiry", { sessionId, inquiryId });

    const { error } = await this.supabase
      .from("conversation_sessions")
      .update({ inquiry_id: inquiryId })
      .eq("id", sessionId);

    if (error) {
      // Non-fatal — FK link is nice-to-have
      logger.warn("Failed to link session to inquiry (non-fatal)", {
        sessionId,
        inquiryId,
        error: error.message,
      });
      return;
    }

    logger.db("Session linked to inquiry successfully", {
      sessionId,
      inquiryId,
    });
  }

  // ── Log a tool call for the audit trail ──────────────────

  async logToolCall(
    sessionId: string,
    toolName: string,
    inputParams: Record<string, unknown>, // DB column: input_params
    outputResult: Record<string, unknown> | null, // DB column: output_result
    success: boolean,
    durationMs: number,
    errorMessage?: string,
    geminiTurnIndex: number = 0,
  ): Promise<void> {
    logger.tool("Logging tool call to audit trail", {
      sessionId,
      toolName,
      success,
      durationMs,
      geminiTurnIndex,
    });

    const { error } = await this.supabase.from("tool_call_logs").insert({
      session_id: sessionId,
      tool_name: toolName,
      input_params: inputParams, // Correct column name from migration 005
      output_result: outputResult, // Correct column name from migration 005
      success,
      duration_ms: durationMs,
      error_message: errorMessage ?? null,
      error_code: errorMessage ? "TOOL_EXECUTION_ERROR" : null,
      gemini_turn_index: geminiTurnIndex,
    });

    if (error) {
      // Audit logs are best-effort — never throw here
      logger.warn("Failed to log tool call (non-fatal)", {
        sessionId,
        toolName,
        error: error.message,
      });
    }
  }

  // ── Trim message history to stay within token limits ──────

  private trimMessages(messages: GeminiMessage[]): GeminiMessage[] {
    logger.info("Trimming message history to reduce token usage", {
      before: messages.length,
      limit: MAX_MESSAGES_BEFORE_TRIM,
    });

    // Keep first 4 messages (initial greeting context) + most recent tail
    const kept = [
      ...messages.slice(0, 4),
      ...messages.slice(-(MAX_MESSAGES_BEFORE_TRIM - 4)),
    ];

    logger.info("Messages trimmed", {
      before: messages.length,
      after: kept.length,
    });

    return kept;
  }
}
