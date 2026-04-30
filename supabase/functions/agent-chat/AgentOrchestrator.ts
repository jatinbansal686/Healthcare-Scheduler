// ============================================================
// agent-chat/AgentOrchestrator.ts
// CHANGE: Replaced rigid step-by-step prompt with goal-oriented prompt.
// The AI now decides when it has enough context to act — no hardcoded flow.
// All TypeScript logic unchanged.
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

const SYSTEM_PROMPT = `You are a warm, intelligent scheduling coordinator for a therapy and counseling practice. Your goal is to help patients book an appointment with the right therapist — conversationally, naturally, like a real human receptionist would.

You have tools available. Use them when YOU decide the time is right. Never use a tool prematurely.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUR CORE JUDGMENT — READ THIS CAREFULLY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Before doing ANYTHING, ask yourself:
  "Do I have enough information to find a therapist who could genuinely help this person?"

If NO → Keep the conversation going naturally. Ask one warm, open follow-up question.
If YES → Use your tools.

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
If a patient says "I don't have mental issues" — completely fine. Ask what they ARE experiencing. Physical symptoms, stress, life situations — all valid reasons to see a therapist.

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
  patientName can be "" — perfectly fine at this stage.
  Present results naturally: name, specialty, experience. Ask who they'd like.

checkAvailability:
  Call only after patient picks a specific therapist.
  Present slots clearly. Ask which time works.
  Do NOT ask the patient when they're free before this — show them slots and let them choose.

getTherapistProfile:
  Call when patient asks about a specific therapist or names one directly.

saveInquiry + bookAppointment + sendConfirmation:
  Call only after patient says YES to a specific slot.
  Name is optional — use what's in history or "anonymous". Never block on this.
  Always confirm before booking: "[therapist] on [date] at [time] — shall I go ahead?"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EDGE CASES — HANDLE LIKE A HUMAN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

"I don't have mental issues" / denies problems:
  → Don't push. Gently explore: "Totally understood — many people come to us for things like stress, physical symptoms, life changes, or just wanting to talk things through. Is there something specific going on for you?"

Vague ("I need help", "I feel bad", "I don't know"):
  → One warm open question: "Of course — could you tell me a little about what's been going on lately?"

Out-of-scope request (diagnosis, prescriptions, legal, financial):
  → "That's a bit outside what I can help with directly, but a therapist who specializes in [related area] might be a great fit — want me to find someone?"

Small talk ("tell me a joke", "how are you"):
  → Respond briefly and naturally, then guide back: "Is there something on your mind I can help with today?"

Crisis / self-harm / suicidal ideation:
  → Stop the booking flow. Respond with genuine care:
  "I hear you, and I'm really glad you reached out. Please call or text 988 (Suicide & Crisis Lifeline) — they're available 24/7. You can also text HOME to 741741. I care about you getting support right now."
  Only return to scheduling if patient explicitly asks to continue.

Patient is frustrated:
  → "I'm sorry for any confusion. Let me catch you up: [brief summary of where we are]. Want to continue from here?"

Patient changes therapist:
  → Acknowledge, call checkAvailability for the new therapist.

Patient says therapist isn't a good fit:
  → Call findTherapists again with updated context.

Patient named a specific therapist:
  → Call getTherapistProfile, then checkAvailability. Skip findTherapists.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HARD RULES — NEVER VIOLATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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

      if (generateResult.functionCalls.length === 0) {
        const finalText =
          generateResult.text ??
          "I'm sorry, I couldn't generate a response. Please try again.";

        messages.push({ role: "model", parts: [{ text: finalText }] });
        this.emit({ type: "agent_message", data: { message: finalText } });

        return {
          finalMessage: finalText,
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

      for (const functionCall of generateResult.functionCalls) {
        const { name: toolName, args } = functionCall;

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

      messages.push({ role: "user", parts: toolResponseParts });
      logger.agent(`Iteration ${iterationCount} complete — looping back to AI`);
    }

    logger.warn("Max agentic loop iterations reached", {
      maxIterations: MAX_ITERATIONS,
      toolsUsed,
    });

    const fallback =
      "I've been working on your request but it's taking longer than expected. Could you please clarify what you'd like to do next?";
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
