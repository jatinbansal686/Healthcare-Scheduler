// // ============================================================
// // agent-chat/AgentOrchestrator.ts
// // PATCHED: returns fullMessages so index.ts can persist full history
// // ============================================================

// import type { IGoogleAIClient } from "./google/IGoogleClient.ts";
// import type { ITool, ToolContext } from "./tools/ITool.ts";
// import type {
//   GeminiMessage,
//   GeminiFunctionCallPart,
//   GeminiFunctionResponsePart,
//   SSEEvent,
//   SessionState,
// } from "../_shared/types.ts";
// import { createLogger } from "../_shared/logger.ts";
// import { AIProviderError } from "../_shared/error.ts";
// import { SessionManager } from "./sessionManager.ts";

// const logger = createLogger("AgentOrchestrator");

// const MAX_ITERATIONS = 15;

// const SYSTEM_PROMPT = `You are a compassionate and professional healthcare scheduling assistant for a therapy practice. Your role is to help patients find and book appointments with the right therapist.

// BEHAVIOR GUIDELINES:
// 1. Be warm, empathetic, and non-judgmental — patients may be sharing sensitive information
// 2. You MUST use your tools to perform real actions — never simulate or make up data
// 3. If a patient seems in crisis, acknowledge their feelings and encourage them to call 988 (Suicide & Crisis Lifeline) while also helping them book urgently

// STRICT CONVERSATION FLOW — follow these steps in order:

// STEP 1 — When patient first describes their situation:
//   - Immediately call extractStructuredInfo with what you know so far
//   - Then call saveInquiry to create the record
//   - Then call findTherapists to search the database
//   - Present the matching therapists to the patient in a readable format (name, specialties, years of experience)
//   - END YOUR TURN HERE. Wait for the patient to respond. Do NOT proceed further.

// STEP 2 — After patient indicates a therapist preference:
//   - Call checkAvailability for ONLY the chosen therapist (not all therapists)
//   - Present the available slots to the patient clearly (e.g. "Monday Apr 27 at 9:00 AM")
//   - Ask: "Which time slot works best for you?"
//   - END YOUR TURN HERE. Wait for the patient to respond.

// STEP 3 — After patient selects a time slot:
//   - Confirm back: "Just to confirm — you'd like to book with [therapist] on [date] at [time]. Shall I go ahead?"
//   - END YOUR TURN HERE. Wait for the patient to respond.

// STEP 4 — Only after patient says YES to confirmation:
//   - Call bookAppointment with the confirmed therapist and slot
//   - Call sendConfirmation with the appointment details
//   - Present the confirmation to the patient

// CRITICAL RULES:
// - NEVER call bookAppointment without explicit patient confirmation in STEP 3
// - NEVER call checkAvailability for all therapists at once — only for the patient's chosen one
// - NEVER call getTherapistProfile in bulk — only if the patient asks for more details
// - ALWAYS use the exact therapist UUIDs returned by findTherapists — never guess or invent IDs
// - If no therapists match, be honest and suggest alternatives (self-pay, broaden search)
// - Never invent therapist names, availability, or insurance details`;

// export interface OrchestratorOptions {
//   aiClient: IGoogleAIClient;
//   tools: ITool[];
//   toolContext: ToolContext;
//   sessionManager: SessionManager;
//   sessionId: string;
//   onEvent?: (event: SSEEvent) => void;
// }

// export interface OrchestratorResult {
//   finalMessage: string;
//   toolsUsed: string[];
//   iterationCount: number;
//   updatedSessionState: Partial<SessionState>;
//   /**
//    * The complete interleaved message array including all tool call/response
//    * parts from this turn. index.ts MUST persist this instead of reconstructing
//    * a [user_text, model_text] pair — the full history is what gives Gemini
//    * memory of which therapist IDs it returned on the previous turn.
//    */
//   fullMessages: GeminiMessage[];
// }

// export class AgentOrchestrator {
//   private readonly aiClient: IGoogleAIClient;
//   private readonly tools: Map<string, ITool>;
//   private readonly toolContext: ToolContext;
//   private readonly sessionManager: SessionManager;
//   private readonly sessionId: string;
//   private readonly onEvent?: (event: SSEEvent) => void;

//   constructor(options: OrchestratorOptions) {
//     logger.agent("AgentOrchestrator initializing", {
//       toolCount: options.tools.length,
//       toolNames: options.tools.map((t) => t.name),
//       sessionId: options.sessionId,
//     });

//     this.aiClient = options.aiClient;
//     this.tools = new Map(options.tools.map((t) => [t.name, t]));
//     this.toolContext = options.toolContext;
//     this.sessionManager = options.sessionManager;
//     this.sessionId = options.sessionId;
//     this.onEvent = options.onEvent;

//     logger.agent("AgentOrchestrator initialized");
//   }

//   async run(
//     userMessage: string,
//     history: GeminiMessage[],
//   ): Promise<OrchestratorResult> {
//     logger.agent("AgentOrchestrator.run called", {
//       userMessage: userMessage.slice(0, 100),
//       historyLength: history.length,
//     });

//     const messages: GeminiMessage[] = [
//       ...history,
//       { role: "user", parts: [{ text: userMessage }] },
//     ];

//     const toolDeclarations = Array.from(this.tools.values()).map(
//       (t) => t.declaration,
//     );
//     const toolsUsed: string[] = [];
//     let iterationCount = 0;
//     const updatedSessionState: Partial<SessionState> = {};

//     this.emit({ type: "agent_thinking", data: { message: "Thinking..." } });

//     while (iterationCount < MAX_ITERATIONS) {
//       iterationCount++;
//       logger.agent(
//         `Agentic loop iteration ${iterationCount}/${MAX_ITERATIONS}`,
//       );

//       let generateResult;
//       try {
//         generateResult = await this.aiClient.generateWithTools(
//           messages,
//           toolDeclarations,
//           SYSTEM_PROMPT,
//         );
//       } catch (err) {
//         logger.error("Gemini generateWithTools failed", err);
//         throw new AIProviderError(
//           `AI generation failed: ${err instanceof Error ? err.message : String(err)}`,
//           err,
//         );
//       }

//       logger.agent("Gemini response received", {
//         hasFunctionCalls: generateResult.functionCalls.length > 0,
//         hasText: !!generateResult.text,
//         finishReason: generateResult.finishReason,
//       });

//       if (generateResult.functionCalls.length === 0) {
//         const finalText =
//           generateResult.text ??
//           "I'm sorry, I couldn't generate a response. Please try again.";

//         logger.agent("No function calls — final response received", {
//           responseLength: finalText.length,
//           iterationCount,
//         });

//         messages.push({ role: "model", parts: [{ text: finalText }] });
//         this.emit({ type: "agent_message", data: { message: finalText } });

//         return {
//           finalMessage: finalText,
//           toolsUsed,
//           iterationCount,
//           updatedSessionState,
//           fullMessages: messages,
//         };
//       }

//       const modelFunctionCallParts: GeminiFunctionCallPart[] =
//         generateResult.functionCalls.map((fc) => ({
//           functionCall: { name: fc.name, args: fc.args },
//         }));

//       messages.push({ role: "model", parts: modelFunctionCallParts });

//       const toolResponseParts: GeminiFunctionResponsePart[] = [];

//       for (const functionCall of generateResult.functionCalls) {
//         const { name: toolName, args } = functionCall;

//         logger.tool(`Executing tool: ${toolName}`, { args });
//         this.emit({ type: "tool_start", data: { toolName, args } });

//         const tool = this.tools.get(toolName);
//         if (!tool) {
//           logger.warn(`Unknown tool requested: ${toolName}`);
//           toolResponseParts.push({
//             functionResponse: {
//               name: toolName,
//               response: {
//                 success: false,
//                 error: `Tool '${toolName}' not registered.`,
//               },
//             },
//           });
//           continue;
//         }

//         const startMs = Date.now();
//         let toolResult;
//         try {
//           toolResult = await tool.execute(args, this.toolContext);
//         } catch (err) {
//           logger.error(`Tool '${toolName}' threw unexpected error`, err);
//           toolResult = {
//             success: false,
//             error: `Unexpected error in '${toolName}': ${err instanceof Error ? err.message : String(err)}`,
//           };
//         }

//         const durationMs = Date.now() - startMs;
//         logger.tool(`Tool '${toolName}' completed`, {
//           success: toolResult.success,
//           durationMs,
//         });

//         this.sessionManager
//           .logToolCall(
//             this.sessionId,
//             toolName,
//             args,
//             toolResult.data ?? null,
//             toolResult.success,
//             durationMs,
//             toolResult.error,
//           )
//           .catch((logErr) =>
//             logger.warn("Tool call audit log failed (non-fatal)", logErr),
//           );

//         toolsUsed.push(toolName);
//         this.updateSessionState(toolName, toolResult.data, updatedSessionState);

//         this.emit({
//           type: "tool_end",
//           data: {
//             toolName,
//             success: toolResult.success,
//             durationMs,
//             result: toolResult.data,
//             error: toolResult.error,
//           },
//         });

//         const responsePayload = toolResult.success
//           ? (toolResult.data ?? { success: true })
//           : { success: false, error: toolResult.error };

//         toolResponseParts.push({
//           functionResponse: {
//             name: toolName,
//             response: responsePayload as Record<string, unknown>,
//           },
//         });
//       }

//       messages.push({ role: "user", parts: toolResponseParts });
//       logger.agent(
//         `Iteration ${iterationCount} complete — looping back to Gemini`,
//       );
//     }

//     logger.warn("Max agentic loop iterations reached", {
//       maxIterations: MAX_ITERATIONS,
//       toolsUsed,
//     });

//     const fallback =
//       "I've been working on your request but it's taking longer than expected. Could you please clarify what you'd like to do next?";
//     return {
//       finalMessage: fallback,
//       toolsUsed,
//       iterationCount,
//       updatedSessionState,
//       fullMessages: messages,
//     };
//   }

//   private emit(event: SSEEvent): void {
//     if (this.onEvent) {
//       console.log(
//         "[AGENT] [AgentOrchestrator] Emitting SSE event:",
//         event.type,
//       );
//       this.onEvent(event);
//     }
//   }

//   private updateSessionState(
//     toolName: string,
//     data: Record<string, unknown> | undefined,
//     state: Partial<SessionState>,
//   ): void {
//     if (!data) return;
//     state.lastToolUsed = toolName;
//     switch (toolName) {
//       case "extractStructuredInfo":
//         if (data.conditions)
//           state.extractedConditions = data.conditions as string[];
//         if (data.insurance) state.extractedInsurance = data.insurance as string;
//         if (data.schedule) state.extractedSchedule = data.schedule as string;
//         if (data.patientName) state.patientName = data.patientName as string;
//         break;
//       case "findTherapists":
//         if (
//           data.therapists &&
//           Array.isArray(data.therapists) &&
//           data.therapists.length > 0
//         ) {
//           state.matchedTherapistId = (
//             data.therapists[0] as Record<string, unknown>
//           ).id as string;
//         }
//         break;
//       case "bookAppointment":
//         if (data.appointmentId) state.appointmentBooked = true;
//         break;
//     }
//     logger.agent("Session state updated", { toolName, state });
//   }
// }

// ============================================================
// agent-chat/AgentOrchestrator.ts
// SOLID: OCP/DIP — depends on IAIClient abstraction; provider is injected externally
// CHANGE LOG: IGoogleAIClient → IAIClient; GeminiMessage → AIMessage (structural aliases)
// ============================================================

// DIP: depend on abstraction, not on any concrete provider
import type { IAIClient } from "./ai/IAIClient.ts";
import type { ITool, ToolContext } from "./tools/ITool.ts";
import type {
  GeminiMessage, // AIMessage is structurally identical — keep alias for zero diff elsewhere
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

const SYSTEM_PROMPT = `You are a compassionate and professional healthcare scheduling assistant for a therapy practice. Your role is to help patients find and book appointments with the right therapist.

BEHAVIOR GUIDELINES:
1. Be warm, empathetic, and non-judgmental — patients may be sharing sensitive information
2. You MUST use your tools to perform real actions — never simulate or make up data
3. If a patient seems in crisis, acknowledge their feelings and encourage them to call 988 (Suicide & Crisis Lifeline)

STRICT CONVERSATION FLOW:

STEP 1 — Patient first describes their situation:
  - Call extractStructuredInfo with conditions, insurance, schedule from their message
  - If patient did NOT provide their name, ask for it warmly in your reply
  - Do NOT call saveInquiry or findTherapists yet if you don't have their name
  - END YOUR TURN. Wait for patient response.

STEP 1b — Patient provides their name (message is just a name):
  - Call extractStructuredInfo with patientName set and conditions as [] (empty array is fine here)
  - Then call saveInquiry with the real patient name (NEVER use empty string or "anonymous")
  - Then call findTherapists
  - Present matching therapists (name, specialties, years of experience)
  - END YOUR TURN. Wait for patient response.

  NOTE: If the patient provided their name in STEP 1's first message, skip asking and go directly to saveInquiry + findTherapists.

STEP 2 — Patient indicates therapist preference:
  - Call checkAvailability for ONLY the chosen therapist
  - Present available slots clearly
  - Ask which time slot works best
  - END YOUR TURN. Wait for patient response.

STEP 3 — Patient selects a time slot:
  - Confirm: "Just to confirm — [therapist] on [date] at [time] for [patient name]. Shall I go ahead?"
  - END YOUR TURN. Wait for patient response.

STEP 4 — Patient confirms YES:
  - Call bookAppointment with the real patient name (NEVER "anonymous")
  - Call sendConfirmation
  - Present confirmation to patient

CRITICAL RULES:
- NEVER pass empty string or "anonymous" as patientName to saveInquiry or bookAppointment
- NEVER call bookAppointment without explicit YES confirmation from patient
- NEVER call checkAvailability for multiple therapists — only the chosen one
- ALWAYS use exact therapist UUIDs from findTherapists results
- extractStructuredInfo accepts conditions:[] when patient is only giving their name`;

export interface OrchestratorOptions {
  aiClient: IAIClient; // ← was IGoogleAIClient; now provider-agnostic
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
  private readonly aiClient: IAIClient; // ← abstraction, not concrete class
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
