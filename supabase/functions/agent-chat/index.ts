// ============================================================
// agent-chat/index.ts — PATCHED: multi-provider AI chain (Gemini → OpenAI → DeepSeek)
// ============================================================

import { handleCors, corsJson, corsStream } from "../_shared/cors.ts";
import { validateChatRequest } from "../_shared/validator.ts";
import { createLogger } from "../_shared/logger.ts";
import { normalizeError } from "../_shared/error.ts";
import { getSupabaseAdmin } from "../_shared/supabaseAdmin.ts";
import type { SSEEvent } from "../_shared/types.ts";

// ── AI providers (new structure) ─────────────────────────────
import { GoogleAIClient } from "./ai/providers/GoogleAIClient.ts";
import { OpenAIClient } from "./ai/providers/OpenAIClient.ts";
import { DeepSeekClient } from "./ai/providers/DeepSeekClient.ts";
import { AIProviderChain } from "./ai/AIProviderChain.ts";
import type { IAIClient } from "./ai/IAIClient.ts";
// ─────────────────────────────────────────────────────────────

import { GoogleCalendarClient } from "./google/GoogleCalendarClient.ts";
import { TokenRefresher } from "./google/tokenRefresher.ts";
import { ToolRegistry } from "./tools/toolRegistry.ts";
import { SessionManager } from "./sessionManager.ts";
import { AgentOrchestrator } from "./AgentOrchestrator.ts";
import type { ToolContext } from "./tools/ITool.ts";

const logger = createLogger("AgentChatFunction");

/**
 * Build the provider chain once per request.
 * Providers whose API key is missing are skipped gracefully.
 * Order = priority: Gemini → OpenAI → DeepSeek.
 * To change priority or add a provider — only touch this function.
 */
function buildAIClient(): IAIClient {
  const providers: IAIClient[] = [];

  // try {
  //   providers.push(new GoogleAIClient());
  // } catch (e) {
  //   logger.warn("Gemini unavailable — skipping", {
  //     reason: (e as Error).message,
  //   });
  // }

  try {
    providers.push(new OpenAIClient());
  } catch (e) {
    logger.warn("OpenAI unavailable — skipping", {
      reason: (e as Error).message,
    });
  }

  try {
    providers.push(new DeepSeekClient());
  } catch (e) {
    logger.warn("DeepSeek unavailable — skipping", {
      reason: (e as Error).message,
    });
  }

  if (providers.length === 0) {
    throw new Error(
      "No AI providers configured. Set at least one of: GEMINI_API_KEY, OPENAI_API_KEY, DEEPSEEK_API_KEY",
    );
  }

  return new AIProviderChain(providers);
}

Deno.serve(async (req: Request) => {
  logger.info("agent-chat function invoked", {
    method: req.method,
    url: req.url,
  });

  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    // FIX: pass req as first argument so getCorsHeaders can read the origin
    return corsJson(
      req,
      {
        success: false,
        error: { code: "METHOD_NOT_ALLOWED", message: "Only POST is accepted" },
      },
      405,
    );
  }

  try {
    logger.info("Parsing request body");
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      // FIX: pass req as first argument
      return corsJson(
        req,
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Request body must be valid JSON",
          },
        },
        400,
      );
    }

    const { message, sessionId, patientIdentifier } = validateChatRequest(body);
    const activeSessionId = sessionId ?? crypto.randomUUID();
    const activePatientId = patientIdentifier ?? "anonymous";

    logger.info("Request validated", {
      sessionId: activeSessionId,
      patientId: activePatientId,
      messageLength: message.length,
    });

    logger.info("Initializing dependencies");
    const supabase = getSupabaseAdmin();
    const aiClient = buildAIClient(); // ← chain: Gemini → OpenAI → DeepSeek
    const calendarClient = new GoogleCalendarClient();
    const tokenRefresher = new TokenRefresher();
    const toolRegistry = new ToolRegistry();
    const sessionManager = new SessionManager();

    const toolContext: ToolContext = {
      supabase,
      calendarClient,
      tokenRefresher,
      sessionId: activeSessionId,
    };

    logger.info("All dependencies initialized", {
      aiProvider: aiClient.providerName,
      toolCount: toolRegistry.getAll().length,
    });

    logger.info("Loading session from DB");
    const session = await sessionManager.getOrCreateSession(
      activeSessionId,
      activePatientId,
    );

    const history = session.messages ?? [];
    const currentSessionState = session.session_state;
    const currentTurnCount = session.turn_count ?? 0;

    logger.info("Session loaded", {
      sessionId: activeSessionId,
      historyLength: history.length,
      turnCount: currentTurnCount,
      sessionStatus: session.session_status,
    });

    logger.info("Setting up SSE stream");
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    function writeSSE(event: SSEEvent): void {
      const frame = `data: ${JSON.stringify(event)}\n\n`;
      console.log("[INFO] [AgentChatFunction] Writing SSE event:", event.type);
      writer.write(encoder.encode(frame)).catch((err) => {
        logger.error("Failed to write SSE event", {
          eventType: event.type,
          err,
        });
      });
    }

    (async () => {
      try {
        logger.agent("Starting AgentOrchestrator");

        const orchestrator = new AgentOrchestrator({
          aiClient,
          tools: toolRegistry.getAll(),
          toolContext,
          sessionManager,
          sessionId: activeSessionId,
          onEvent: writeSSE,
        });

        const result = await orchestrator.run(message, history);

        logger.agent("AgentOrchestrator completed successfully", {
          aiProvider: aiClient.providerName,
          toolsUsed: result.toolsUsed,
          iterationCount: result.iterationCount,
          finalMessageLength: result.finalMessage.length,
        });

        const mergedSessionState = {
          ...currentSessionState,
          ...result.updatedSessionState,
        };

        logger.info("Persisting session to DB", {
          sessionId: activeSessionId,
          messageCount: result.fullMessages.length,
          newTurnCount: currentTurnCount + 1,
        });

        await sessionManager.saveSession(
          activeSessionId,
          result.fullMessages, // full interleaved history (tool calls + responses + text)
          mergedSessionState,
        );

        const { error: turnCountError } = await supabase
          .from("conversation_sessions")
          .update({ turn_count: currentTurnCount + 1 })
          .eq("id", activeSessionId);

        if (turnCountError) {
          logger.warn("Failed to increment turn_count (non-fatal)", {
            error: turnCountError.message,
          });
        }

        logger.info("Session persisted successfully");

        writeSSE({
          type: "done",
          data: {
            sessionId: activeSessionId,
            toolsUsed: result.toolsUsed,
            iterationCount: result.iterationCount,
          },
        });
      } catch (err) {
        logger.error("AgentOrchestrator run failed", { err });
        const normalized = normalizeError(err);
        writeSSE({
          type: "error",
          data: { code: normalized.code, message: normalized.message },
        });
        await sessionManager
          .updateSessionStatus(activeSessionId, "error")
          .catch(() => {});
      } finally {
        logger.info("Closing SSE stream writer");
        writer
          .close()
          .catch((e) => logger.error("Error closing stream writer", { e }));
      }
    })();

    logger.info("Returning SSE stream to client");
    // FIX: pass req as first argument
    return corsStream(req, readable);
  } catch (err) {
    logger.error("Unhandled top-level error in agent-chat", { err });
    const normalized = normalizeError(err);
    // FIX: pass req as first argument
    return corsJson(
      req,
      {
        success: false,
        error: { code: normalized.code, message: normalized.message },
      },
      normalized.statusCode,
    );
  }
});
