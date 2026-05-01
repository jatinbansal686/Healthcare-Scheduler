// ============================================================
// agent-chat/AgentOrchestrator.ts
// CHANGE: Intercepts `respondToUser` tool calls and emits a
// `structured_message` SSE event with typed UI data.
// All other logic is 100% unchanged.
// ============================================================

import type { IAIClient } from "./ai/IAIClient.ts";
import type { ITool, ToolContext } from "./tools/ITool.ts";
import type {
  GeminiMessage,
  GeminiFunctionCallPart,
  GeminiFunctionResponsePart,
  SSEEvent,
  SessionState,
} from "../_shared/types.ts";
import { createLogger } from "../_shared/logger.ts";
import { AIProviderError } from "../_shared/error.ts";
import { SessionManager } from "./sessionManager.ts";

const logger = createLogger("AgentOrchestrator");

const MAX_ITERATIONS = 15;

// ── Tool name constant — single place to change if renamed ───
const RESPOND_TO_USER_TOOL = "respondToUser";

const SYSTEM_PROMPT = `You are a warm, intelligent scheduling coordinator for a therapy and counseling practice. Your goal is to help patients book an appointment with the right therapist — conversationally, naturally, like a real human receptionist would.

You have tools available. Use them when YOU decide the time is right. Never use a tool prematurely.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITICAL: HOW TO RESPOND TO THE USER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

YOU MUST ALWAYS use the \`respondToUser\` tool to send any message to the patient.
NEVER return plain text — it will not be shown to the user.
Every single reply, question, confirmation, and update MUST go through respondToUser.

Choose ui_hint based on what you're sending:
  "text"         → any conversational reply, question, or update
  "therapists"   → after findTherapists returns results — pass the therapists array
  "slots"        → after checkAvailability returns results — pass the slots array
  "confirmation" → after bookAppointment succeeds — pass the confirmation object
  "out_of_scope" → user asked something outside scheduling (jokes, medical advice, etc.)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUR CORE JUDGMENT — READ THIS CAREFULLY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Before doing ANYTHING, ask yourself:
  "Do I have enough information to find a therapist who could genuinely help this person?"

If NO → Keep the conversation going naturally. Ask one warm, open follow-up question via respondToUser(ui_hint: "text").
If YES → Use your tools, then call respondToUser with the results.

What counts as "enough information":
  ✓ You understand WHY the patient is here — even roughly (a symptom, a life situation, a feeling, a physical concern, a relationship issue — anything)
  ✗ "no mental issues" alone is NOT enough — you still don't know what they need
  ✗ A name alone is NOT enough
  ✗ "I need help" alone is NOT enough

When you're unsure what the patient needs, ask ONE empathetic follow-up question. Then reassess.
When the patient gives you ANYTHING useful — a feeling, a situation, a symptom, a concern — that's enough. Act on it.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCOPE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
You help with EVERYTHING the practice offers: mental health, physical symptoms affecting daily life, chronic illness, life transitions, relationships, grief, burnout, parenting, identity, performance, sleep, eating, postpartum, and more.

NEVER tell a patient their concern is outside scope. NEVER restrict to mental health only.
If a patient says "I don't have mental issues" — completely fine. Ask what they ARE experiencing.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MEMORY — APPLY BEFORE EVERY RESPONSE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
You have the full conversation history. Use it.
- Already know their name? Never ask again.
- Already know their concern? Never ask again.
- Already showed therapists? Don't call findTherapists again unless they want a change.
- Already showed availability? Don't call checkAvailability again unless they chose a different therapist.
- NEVER repeat a question you've already asked.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HOW TO USE YOUR TOOLS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

extractStructuredInfo + findTherapists:
  Call these together when you genuinely understand what the patient needs.
  After findTherapists returns, call respondToUser(ui_hint: "therapists", therapists: [...]).
  Pass the EXACT therapist objects from findTherapists results.

checkAvailability:
  Call only after patient picks a specific therapist.
  After it returns, call respondToUser(ui_hint: "slots", slots: [...]).
  Pass the EXACT slot objects from checkAvailability's availableSlots array.
  Each slot needs: startTime, endTime, label, therapistId, therapistName.
  Do NOT ask the patient when they're free before this — show them slots and let them choose.

getTherapistProfile:
  Call when patient asks about a specific therapist or names one directly.

saveInquiry + bookAppointment + sendConfirmation:
  Call only after patient says YES to a specific slot.
  Name is optional — use what's in history or "anonymous". Never block on this.
  Always confirm before booking: call respondToUser(ui_hint: "text") with
  "[therapist] on [date] at [time] — shall I go ahead?"
  After booking succeeds, call respondToUser(ui_hint: "confirmation", confirmation: {...}).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EDGE CASES — HANDLE LIKE A HUMAN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

"I don't have mental issues" / denies problems:
  → respondToUser(ui_hint:"text", message: "Totally understood — many people come to us for things like stress, physical symptoms, life changes, or just wanting to talk things through. Is there something specific going on for you?")

Vague ("I need help", "I feel bad", "I don't know"):
  → respondToUser(ui_hint:"text", message: one warm open question)

Fee / charges / cost questions ("what does it cost?", "what are the charges?", "how much does Dr. X charge?"):
  → NEVER use out_of_scope for this. Answer from the data you have:
  - If you have the therapist profile (from getTherapistProfile or findTherapists), tell the patient:
    * Which insurance plans the therapist accepts (from accepted_insurance field)
    * Whether self-pay is listed
    * Session duration (session_duration_minutes)
    * That exact fee amounts are confirmed at booking / by the office
  - Example: respondToUser(ui_hint:"text", message: "Dr. Mitchell accepts Aetna, BlueCross, Cigna, and self-pay. Sessions are 50 minutes. The exact self-pay rate is confirmed when you book — would you like to see her availability?")
  - If you have NO profile data yet, call getTherapistProfile first, then answer.

Out-of-scope request (ONLY: jokes, recipes, legal advice, medical diagnosis, prescriptions, financial investment advice, unrelated general knowledge):
  → respondToUser(ui_hint:"out_of_scope", message: "That's a bit outside what I can help with, but I'm happy to help you find the right therapist. Would you like to continue?")

Crisis / self-harm / suicidal ideation:
  → respondToUser(ui_hint:"text", message: "I hear you, and I'm really glad you reached out. Please call or text 988 (Suicide & Crisis Lifeline) — they're available 24/7. You can also text HOME to 741741.")
  Only return to scheduling if patient explicitly asks to continue.

Patient is frustrated:
  → respondToUser(ui_hint:"text", message: "I'm sorry for any confusion. Let me catch you up: [brief summary]. Want to continue from here?")

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HARD RULES — NEVER VIOLATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- ALWAYS use respondToUser — never return plain text
- Never call bookAppointment without an explicit YES from the patient
- Never call checkAvailability for multiple therapists at once
- Never fabricate therapist names, UUIDs, slots, or IDs
- Always use exact UUIDs from tool results
- Insurance is optional — never block the flow waiting for it
- Name is optional — use "anonymous" if not provided, never ask twice`;

export interface OrchestratorOptions {
  aiClient: IAIClient;
  tools: ITool[];
  toolContext: ToolContext;
  sessionManager: SessionManager;
  sessionId: string;
  onEvent?: (event: SSEEvent) => void;
}

export interface OrchestratorResult {
  finalMessage: string;
  toolsUsed: string[];
  iterationCount: number;
  updatedSessionState: Partial<SessionState>;
  fullMessages: GeminiMessage[];
}

export class AgentOrchestrator {
  private readonly aiClient: IAIClient;
  private readonly tools: Map<string, ITool>;
  private readonly toolContext: ToolContext;
  private readonly sessionManager: SessionManager;
  private readonly sessionId: string;
  private readonly onEvent?: (event: SSEEvent) => void;

  constructor(options: OrchestratorOptions) {
    logger.agent("AgentOrchestrator initializing", {
      toolCount: options.tools.length,
      toolNames: options.tools.map((t) => t.name),
      sessionId: options.sessionId,
      aiProvider: options.aiClient.providerName,
    });
    this.aiClient = options.aiClient;
    this.tools = new Map(options.tools.map((t) => [t.name, t]));
    this.toolContext = options.toolContext;
    this.sessionManager = options.sessionManager;
    this.sessionId = options.sessionId;
    this.onEvent = options.onEvent;
    logger.agent("AgentOrchestrator initialized");
  }

  async run(
    userMessage: string,
    history: GeminiMessage[],
  ): Promise<OrchestratorResult> {
    logger.agent("AgentOrchestrator.run called", {
      userMessage: userMessage.slice(0, 100),
      historyLength: history.length,
    });

    const messages: GeminiMessage[] = [
      ...history,
      { role: "user", parts: [{ text: userMessage }] },
    ];

    const toolDeclarations = Array.from(this.tools.values()).map(
      (t) => t.declaration,
    );
    const toolsUsed: string[] = [];
    let iterationCount = 0;
    const updatedSessionState: Partial<SessionState> = {};

    this.emit({ type: "agent_thinking", data: { message: "Thinking..." } });

    while (iterationCount < MAX_ITERATIONS) {
      iterationCount++;
      logger.agent(
        `Agentic loop iteration ${iterationCount}/${MAX_ITERATIONS}`,
      );

      let generateResult;
      try {
        generateResult = await this.aiClient.generateWithTools(
          messages,
          toolDeclarations,
          SYSTEM_PROMPT,
        );
      } catch (err) {
        logger.error("AI generateWithTools failed", err);
        throw new AIProviderError(
          `AI generation failed: ${err instanceof Error ? err.message : String(err)}`,
          err,
        );
      }

      logger.agent("AI response received", {
        hasFunctionCalls: generateResult.functionCalls.length > 0,
        hasText: !!generateResult.text,
        finishReason: generateResult.finishReason,
      });

      // ── FALLBACK: AI returned plain text instead of calling respondToUser ──
      // Two sub-cases:
      //   A) Model wrote the respondToUser JSON as plain text (common with OpenAI/DeepSeek).
      //      We parse it and treat it exactly like a proper tool call.
      //   B) Truly unstructured text — wrap as structured_message(ui_hint:"text").
      if (generateResult.functionCalls.length === 0) {
        const rawText =
          generateResult.text ??
          "I'm sorry, I couldn't generate a response. Please try again.";

        logger.warn(
          "AI returned plain text instead of calling respondToUser — attempting JSON sniff",
          { textLength: rawText.length },
        );

        messages.push({ role: "model", parts: [{ text: rawText }] });

        // ── Try to parse as respondToUser payload ──────────────
        const parsed = tryParseRespondToUserPayload(rawText);

        if (parsed) {
          logger.agent("Plain-text response parsed as respondToUser payload", {
            ui_hint: parsed.ui_hint,
          });
          this.emit({
            type: "structured_message",
            data: {
              message: parsed.message,
              ui_hint: parsed.ui_hint,
              slots: parsed.slots ?? null,
              therapists: parsed.therapists ?? null,
              confirmation: parsed.confirmation ?? null,
            },
          } as SSEEvent);

          return {
            finalMessage: parsed.message,
            toolsUsed,
            iterationCount,
            updatedSessionState,
            fullMessages: messages,
          };
        }

        // ── Sub-case B: truly unstructured — emit as plain text ─
        logger.warn(
          "Could not parse as structured payload — emitting as plain text",
        );
        this.emit({
          type: "structured_message",
          data: {
            message: rawText,
            ui_hint: "text",
            slots: null,
            therapists: null,
            confirmation: null,
          },
        } as SSEEvent);

        return {
          finalMessage: rawText,
          toolsUsed,
          iterationCount,
          updatedSessionState,
          fullMessages: messages,
        };
      }

      const modelFunctionCallParts: GeminiFunctionCallPart[] =
        generateResult.functionCalls.map((fc) => ({
          functionCall: { name: fc.name, args: fc.args },
        }));

      messages.push({ role: "model", parts: modelFunctionCallParts });

      const toolResponseParts: GeminiFunctionResponsePart[] = [];
      let respondToUserFinalMessage: string | null = null;

      for (const functionCall of generateResult.functionCalls) {
        const { name: toolName, args } = functionCall;

        // ── INTERCEPT: respondToUser ────────────────────────────
        // Do NOT execute this tool. Instead emit structured SSE,
        // inject a synthetic "ok" tool response, and end the loop.
        if (toolName === RESPOND_TO_USER_TOOL) {
          logger.agent("Intercepted respondToUser call", {
            ui_hint: args.ui_hint,
          });

          const message = (args.message as string) ?? "";
          const uiHint = (args.ui_hint as string) ?? "text";

          this.emit({
            type: "structured_message",
            data: {
              message,
              ui_hint: uiHint,
              slots: args.slots ?? null,
              therapists: args.therapists ?? null,
              confirmation: args.confirmation ?? null,
            },
          } as SSEEvent);

          respondToUserFinalMessage = message;

          // Synthetic tool response so message history stays valid
          toolResponseParts.push({
            functionResponse: {
              name: toolName,
              response: { success: true, delivered: true },
            },
          });

          toolsUsed.push(toolName);
          continue; // skip normal tool execution for this call
        }

        // ── Normal tool execution (unchanged) ──────────────────
        logger.tool(`Executing tool: ${toolName}`, { args });
        this.emit({ type: "tool_start", data: { toolName, args } });

        const tool = this.tools.get(toolName);
        if (!tool) {
          logger.warn(`Unknown tool requested: ${toolName}`);
          toolResponseParts.push({
            functionResponse: {
              name: toolName,
              response: {
                success: false,
                error: `Tool '${toolName}' not registered.`,
              },
            },
          });
          continue;
        }

        const startMs = Date.now();
        let toolResult;
        try {
          toolResult = await tool.execute(args, this.toolContext);
        } catch (err) {
          logger.error(`Tool '${toolName}' threw unexpected error`, err);
          toolResult = {
            success: false,
            error: `Unexpected error in '${toolName}': ${err instanceof Error ? err.message : String(err)}`,
          };
        }

        const durationMs = Date.now() - startMs;
        logger.tool(`Tool '${toolName}' completed`, {
          success: toolResult.success,
          durationMs,
        });

        this.sessionManager
          .logToolCall(
            this.sessionId,
            toolName,
            args,
            toolResult.data ?? null,
            toolResult.success,
            durationMs,
            toolResult.error,
          )
          .catch((logErr) =>
            logger.warn("Tool call audit log failed (non-fatal)", logErr),
          );

        toolsUsed.push(toolName);
        this.updateSessionState(toolName, toolResult.data, updatedSessionState);

        this.emit({
          type: "tool_end",
          data: {
            toolName,
            success: toolResult.success,
            durationMs,
            result: toolResult.data,
            error: toolResult.error,
          },
        });

        const responsePayload = toolResult.success
          ? (toolResult.data ?? { success: true })
          : { success: false, error: toolResult.error };

        toolResponseParts.push({
          functionResponse: {
            name: toolName,
            response: responsePayload as Record<string, unknown>,
          },
        });
      }

      // ── If respondToUser was called, end the loop now ─────────
      // The message has been delivered via SSE. No further AI turns needed.
      if (respondToUserFinalMessage !== null) {
        messages.push({ role: "user", parts: toolResponseParts });
        logger.agent("respondToUser intercepted — ending agentic loop", {
          iterationCount,
        });
        return {
          finalMessage: respondToUserFinalMessage,
          toolsUsed,
          iterationCount,
          updatedSessionState,
          fullMessages: messages,
        };
      }

      messages.push({ role: "user", parts: toolResponseParts });
      logger.agent(`Iteration ${iterationCount} complete — looping back to AI`);
    }

    logger.warn("Max agentic loop iterations reached", {
      maxIterations: MAX_ITERATIONS,
      toolsUsed,
    });

    const fallback =
      "I've been working on your request but it's taking longer than expected. Could you please clarify what you'd like to do next?";

    // Even the max-iterations fallback goes through structured_message
    this.emit({
      type: "structured_message",
      data: {
        message: fallback,
        ui_hint: "text",
        slots: null,
        therapists: null,
        confirmation: null,
      },
    } as SSEEvent);

    return {
      finalMessage: fallback,
      toolsUsed,
      iterationCount,
      updatedSessionState,
      fullMessages: messages,
    };
  }

  private emit(event: SSEEvent): void {
    if (this.onEvent) {
      console.log(
        "[AGENT] [AgentOrchestrator] Emitting SSE event:",
        event.type,
      );
      this.onEvent(event);
    }
  }

  private updateSessionState(
    toolName: string,
    data: Record<string, unknown> | undefined,
    state: Partial<SessionState>,
  ): void {
    if (!data) return;
    state.lastToolUsed = toolName;
    switch (toolName) {
      case "extractStructuredInfo":
        if (data.conditions)
          state.extractedConditions = data.conditions as string[];
        if (data.insurance) state.extractedInsurance = data.insurance as string;
        if (data.schedule) state.extractedSchedule = data.schedule as string;
        if (data.patientName) state.patientName = data.patientName as string;
        break;
      case "findTherapists":
        if (
          data.therapists &&
          Array.isArray(data.therapists) &&
          data.therapists.length > 0
        ) {
          state.matchedTherapistId = (
            data.therapists[0] as Record<string, unknown>
          ).id as string;
        }
        break;
      case "bookAppointment":
        if (data.appointmentId) state.appointmentBooked = true;
        break;
    }
    logger.agent("Session state updated", { toolName, state });
  }
}

// ── Helper: parse plain-text respondToUser JSON ───────────────
// Some models (OpenAI, DeepSeek) write the tool payload as plain text
// instead of making a proper function call. This detects and parses it.
//
// Handles all observed patterns:
//   { "message": "...", "ui_hint": "text" }
//   {"message":"...","ui_hint":"slots","slots":[...]}
//   ```json\n{ ... }\n```
//   text before JSON { ... } text after

interface RespondToUserPayload {
  message: string;
  ui_hint: string;
  slots?: unknown[];
  therapists?: unknown[];
  confirmation?: unknown;
}

function tryParseRespondToUserPayload(
  text: string,
): RespondToUserPayload | null {
  // Strip markdown code fences
  const stripped = text
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  // Extract the first JSON object from the text
  // (handles "Some prose { ... } more prose" patterns)
  const jsonMatch = stripped.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

    // Must have at minimum a message string and a ui_hint string
    if (typeof parsed.message !== "string") return null;
    if (typeof parsed.ui_hint !== "string") return null;

    return {
      message: parsed.message,
      ui_hint: parsed.ui_hint,
      slots: Array.isArray(parsed.slots) ? parsed.slots : undefined,
      therapists: Array.isArray(parsed.therapists)
        ? parsed.therapists
        : undefined,
      confirmation:
        parsed.confirmation && typeof parsed.confirmation === "object"
          ? parsed.confirmation
          : undefined,
    };
  } catch {
    return null;
  }
}
