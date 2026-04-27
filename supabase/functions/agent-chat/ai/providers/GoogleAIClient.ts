// // ============================================================
// // agent-chat/ai/providers/GoogleAIClient.ts
// // SOLID: OCP — implements IAIClient; no orchestrator changes needed
// //        SRP — only responsible for Gemini API communication
// // ============================================================

// // @deno-types="npm:@google/generative-ai@0.21.0"
// import {
//   GoogleGenerativeAI,
//   FunctionCallingMode,
//   HarmCategory,
//   HarmBlockThreshold,
// } from "https://esm.sh/@google/generative-ai@0.21.0?target=deno";

// import type {
//   IAIClient,
//   AIMessage,
//   AIFunctionDeclaration,
//   AIGenerateResult,
// } from "../IAIClient.ts";
// import { createLogger } from "../../_shared/logger.ts";
// import { AIProviderError, RateLimitError } from "../../_shared/error.ts";

// const logger = createLogger("GoogleAIClient");

// const GEMINI_MODEL = "gemini-2.0-flash";
// const MAX_RETRIES = 3;
// const INITIAL_RETRY_DELAY_MS = 2000;

// const SAFETY_SETTINGS = [
//   {
//     category: HarmCategory.HARM_CATEGORY_HARASSMENT,
//     threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
//   },
//   {
//     category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
//     threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
//   },
//   {
//     category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
//     threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
//   },
//   {
//     category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
//     threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
//   },
// ];

// export class GoogleAIClient implements IAIClient {
//   readonly providerName = "Gemini";
//   private readonly genAI: GoogleGenerativeAI;

//   constructor() {
//     const apiKey = Deno.env.get("GEMINI_API_KEY");
//     if (!apiKey)
//       throw new AIProviderError(
//         "GEMINI_API_KEY environment variable is not set",
//       );
//     this.genAI = new GoogleGenerativeAI(apiKey);
//     logger.info("GoogleAIClient initialized", { model: GEMINI_MODEL });
//   }

//   async generateWithTools(
//     messages: AIMessage[],
//     tools: AIFunctionDeclaration[],
//     systemInstruction: string,
//   ): Promise<AIGenerateResult> {
//     logger.agent("Calling Gemini generateContent", {
//       messageCount: messages.length,
//       toolCount: tools.length,
//     });
//     return this.generateWithRetry(messages, tools, systemInstruction, 0);
//   }

//   private async generateWithRetry(
//     messages: AIMessage[],
//     tools: AIFunctionDeclaration[],
//     systemInstruction: string,
//     attempt: number,
//   ): Promise<AIGenerateResult> {
//     try {
//       return await this.callGemini(messages, tools, systemInstruction);
//     } catch (err) {
//       const isRateLimit =
//         err instanceof RateLimitError ||
//         (err instanceof Error &&
//           (err.message.includes("429") || err.message.includes("quota")));

//       if (isRateLimit && attempt < MAX_RETRIES) {
//         const delayMs = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
//         logger.warn(
//           `Rate limit — retrying in ${delayMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})`,
//         );
//         await this.sleep(delayMs);
//         return this.generateWithRetry(
//           messages,
//           tools,
//           systemInstruction,
//           attempt + 1,
//         );
//       }
//       throw err;
//     }
//   }

//   private async callGemini(
//     messages: AIMessage[],
//     tools: AIFunctionDeclaration[],
//     systemInstruction: string,
//   ): Promise<AIGenerateResult> {
//     const model = this.genAI.getGenerativeModel({
//       model: GEMINI_MODEL,
//       systemInstruction,
//       safetySettings: SAFETY_SETTINGS,
//       tools: tools.length > 0 ? [{ functionDeclarations: tools }] : undefined,
//       toolConfig:
//         tools.length > 0
//           ? { functionCallingConfig: { mode: FunctionCallingMode.AUTO } }
//           : undefined,
//     });

//     // AIMessage is structurally identical to Gemini's Content — cast directly
//     const contents = messages.map((msg) => ({
//       role: msg.role,
//       parts: msg.parts,
//     }));

//     let rawResponse: unknown;
//     try {
//       const result = await model.generateContent({ contents });
//       rawResponse = result.response;
//     } catch (err) {
//       if (
//         err instanceof Error &&
//         (err.message.includes("429") ||
//           err.message.includes("Too Many Requests"))
//       ) {
//         throw new RateLimitError("Gemini");
//       }
//       throw err;
//     }

//     // deno-lint-ignore no-explicit-any
//     const response = rawResponse as any;

//     const functionCalls = response.functionCalls() ?? [];
//     let text: string | null = null;
//     try {
//       text = response.text() || null;
//     } catch {
//       text = null;
//     }

//     return {
//       text,
//       functionCalls: functionCalls.map(
//         (fc: { name: string; args: Record<string, unknown> }) => ({
//           name: fc.name,
//           args: fc.args,
//         }),
//       ),
//       finishReason: response.candidates?.[0]?.finishReason ?? "STOP",
//     };
//   }

//   private sleep(ms: number): Promise<void> {
//     return new Promise((resolve) => setTimeout(resolve, ms));
//   }
// }

// ============================================================
// agent-chat/ai/providers/GoogleAIClient.ts
// SOLID: OCP — implements IAIClient; no orchestrator changes needed
//        SRP — only responsible for Gemini API communication
// ============================================================

// @deno-types="npm:@google/generative-ai@0.21.0"
import {
  GoogleGenerativeAI,
  FunctionCallingMode,
  HarmCategory,
  HarmBlockThreshold,
} from "https://esm.sh/@google/generative-ai@0.21.0?target=deno";

import type {
  IAIClient,
  AIMessage,
  AIFunctionDeclaration,
  AIGenerateResult,
} from "../IAIClient.ts";
import { createLogger } from "../../../_shared/logger.ts";  // Changed: ../../ → ../../
import { AIProviderError, RateLimitError } from "../../../_shared/error.ts";  // Changed: ../../ → ../../../

const logger = createLogger("GoogleAIClient");

const GEMINI_MODEL = "gemini-2.0-flash";
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 2000;

const SAFETY_SETTINGS = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
];

export class GoogleAIClient implements IAIClient {
  readonly providerName = "Gemini";
  private readonly genAI: GoogleGenerativeAI;

  constructor() {
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey)
      throw new AIProviderError(
        "GEMINI_API_KEY environment variable is not set",
      );
    this.genAI = new GoogleGenerativeAI(apiKey);
    logger.info("GoogleAIClient initialized", { model: GEMINI_MODEL });
  }

  async generateWithTools(
    messages: AIMessage[],
    tools: AIFunctionDeclaration[],
    systemInstruction: string,
  ): Promise<AIGenerateResult> {
    logger.agent("Calling Gemini generateContent", {
      messageCount: messages.length,
      toolCount: tools.length,
    });
    return this.generateWithRetry(messages, tools, systemInstruction, 0);
  }

  private async generateWithRetry(
    messages: AIMessage[],
    tools: AIFunctionDeclaration[],
    systemInstruction: string,
    attempt: number,
  ): Promise<AIGenerateResult> {
    try {
      return await this.callGemini(messages, tools, systemInstruction);
    } catch (err) {
      const isRateLimit =
        err instanceof RateLimitError ||
        (err instanceof Error &&
          (err.message.includes("429") || err.message.includes("quota")));

      if (isRateLimit && attempt < MAX_RETRIES) {
        const delayMs = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
        logger.warn(
          `Rate limit — retrying in ${delayMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})`,
        );
        await this.sleep(delayMs);
        return this.generateWithRetry(
          messages,
          tools,
          systemInstruction,
          attempt + 1,
        );
      }
      throw err;
    }
  }

  private async callGemini(
    messages: AIMessage[],
    tools: AIFunctionDeclaration[],
    systemInstruction: string,
  ): Promise<AIGenerateResult> {
    const model = this.genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      systemInstruction,
      safetySettings: SAFETY_SETTINGS,
      tools: tools.length > 0 ? [{ functionDeclarations: tools }] : undefined,
      toolConfig:
        tools.length > 0
          ? { functionCallingConfig: { mode: FunctionCallingMode.AUTO } }
          : undefined,
    });

    // AIMessage is structurally identical to Gemini's Content — cast directly
    const contents = messages.map((msg) => ({
      role: msg.role,
      parts: msg.parts,
    }));

    let rawResponse: unknown;
    try {
      const result = await model.generateContent({ contents });
      rawResponse = result.response;
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message.includes("429") ||
          err.message.includes("Too Many Requests"))
      ) {
        throw new RateLimitError("Gemini");
      }
      throw err;
    }

    // deno-lint-ignore no-explicit-any
    const response = rawResponse as any;

    const functionCalls = response.functionCalls() ?? [];
    let text: string | null = null;
    try {
      text = response.text() || null;
    } catch {
      text = null;
    }

    return {
      text,
      functionCalls: functionCalls.map(
        (fc: { name: string; args: Record<string, unknown> }) => ({
          name: fc.name,
          args: fc.args,
        }),
      ),
      finishReason: response.candidates?.[0]?.finishReason ?? "STOP",
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}