// @deno-types="npm:@google/generative-ai@0.21.0"
import {
  GoogleGenerativeAI,
  FunctionCallingMode,
  HarmCategory,
  HarmBlockThreshold,
} from "https://esm.sh/@google/generative-ai@0.21.0?target=deno";

import type {
  IGoogleAIClient,
  FunctionDeclaration,
  GenerateResult,
} from "./IGoogleClient.ts";
import type { GeminiMessage } from "../../_shared/types.ts";
import { createLogger } from "../../_shared/logger.ts";
import { AIProviderError, RateLimitError } from "../../_shared/error.ts";

const logger = createLogger("GoogleAIClient");

const GEMINI_MODEL = "gemini-2.0-flash";

// Retry config for 429 rate limit errors
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 2000; // Start at 2s, double each retry

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

export class GoogleAIClient implements IGoogleAIClient {
  private readonly genAI: GoogleGenerativeAI;

  constructor() {
    console.log("[INFO] [GoogleAIClient] Initializing GoogleAIClient");

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      const err = new AIProviderError(
        "GEMINI_API_KEY environment variable is not set",
      );
      logger.error("Missing GEMINI_API_KEY", err);
      throw err;
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    logger.info("GoogleAIClient initialized", { model: GEMINI_MODEL });
  }

  async generateWithTools(
    messages: GeminiMessage[],
    tools: FunctionDeclaration[],
    systemInstruction: string,
  ): Promise<GenerateResult> {
    logger.agent("Calling Gemini generateContent", {
      messageCount: messages.length,
      toolCount: tools.length,
    });

    console.log("[AGENT] [GoogleAIClient] Messages being sent to Gemini:", {
      messageCount: messages.length,
      lastMessageRole: messages[messages.length - 1]?.role,
      toolNames: tools.map((t) => t.name),
    });

    return await this.generateWithRetry(messages, tools, systemInstruction, 0);
  }

  // ── Retry wrapper with exponential backoff ────────────────

  private async generateWithRetry(
    messages: GeminiMessage[],
    tools: FunctionDeclaration[],
    systemInstruction: string,
    attempt: number,
  ): Promise<GenerateResult> {
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
          `Rate limit hit — retrying in ${delayMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})`,
          { attempt, delayMs },
        );
        await this.sleep(delayMs);
        return await this.generateWithRetry(
          messages,
          tools,
          systemInstruction,
          attempt + 1,
        );
      }

      // Not a rate limit, or out of retries — rethrow
      throw err;
    }
  }

  // ── Single Gemini API call ────────────────────────────────

  private async callGemini(
    messages: GeminiMessage[],
    tools: FunctionDeclaration[],
    systemInstruction: string,
  ): Promise<GenerateResult> {
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

    // Convert our GeminiMessage[] to the SDK's Content[] format
    // We manage history ourselves — use generateContent (stateless), not chat
    const contents = messages.map((msg) => ({
      role: msg.role,
      parts: msg.parts,
    }));

    logger.agent("Sending request to Gemini API via generateContent");

    let rawResponse: unknown;
    try {
      const result = await model.generateContent({ contents });
      rawResponse = result.response;
    } catch (err) {
      // Check if it's a fetch response error with status 429
      if (
        err instanceof Error &&
        (err.message.includes("429") ||
          err.message.includes("Too Many Requests"))
      ) {
        logger.error("Gemini API call failed", {
          status: 429,
          statusText: "Too Many Requests",
        });
        throw new RateLimitError("Gemini");
      }
      throw err;
    }

    // deno-lint-ignore no-explicit-any
    const response = rawResponse as any;

    logger.agent("Received response from Gemini API", {
      finishReason: response.candidates?.[0]?.finishReason,
      hasFunctionCalls: !!response.functionCalls()?.length,
    });

    const functionCalls = response.functionCalls() ?? [];
    let text: string | null = null;
    try {
      text = response.text() || null;
    } catch {
      // text() throws if the response only has function calls — that's normal
      text = null;
    }

    console.log("[AGENT] [GoogleAIClient] Gemini response parsed:", {
      hasText: !!text,
      functionCallCount: functionCalls.length,
      functionCallNames: functionCalls.map((fc: { name: string }) => fc.name),
    });

    return {
      text,
      functionCalls: functionCalls.map(
        (fc: { name: string; args: Record<string, unknown> }) => ({
          name: fc.name,
          args: fc.args as Record<string, unknown>,
        }),
      ),
      finishReason: response.candidates?.[0]?.finishReason ?? "STOP",
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
