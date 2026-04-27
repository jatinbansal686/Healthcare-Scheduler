// // ============================================================
// // agent-chat/ai/providers/DeepSeekClient.ts
// // DeepSeek uses an OpenAI-compatible API — thin wrapper around the same format
// // SOLID: OCP — new provider, zero changes elsewhere
// // ============================================================

// import type {
//   IAIClient,
//   AIMessage,
//   AIFunctionDeclaration,
//   AIGenerateResult,
// } from "../IAIClient.ts";
// import { createLogger } from "../../../_shared/logger.ts";
// import { AIProviderError, RateLimitError } from "../../../_shared/error.ts";

// const logger = createLogger("DeepSeekClient");

// const DEEPSEEK_MODEL = "deepseek-chat";
// const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";
// const MAX_RETRIES = 3;
// const INITIAL_RETRY_DELAY_MS = 2000;

// export class DeepSeekClient implements IAIClient {
//   readonly providerName = "DeepSeek";
//   private readonly apiKey: string;

//   constructor() {
//     const apiKey = Deno.env.get("DEEPSEEK_API_KEY");
//     if (!apiKey)
//       throw new AIProviderError(
//         "DEEPSEEK_API_KEY environment variable is not set",
//       );
//     this.apiKey = apiKey;
//     logger.info("DeepSeekClient initialized", { model: DEEPSEEK_MODEL });
//   }

//   async generateWithTools(
//     messages: AIMessage[],
//     tools: AIFunctionDeclaration[],
//     systemInstruction: string,
//   ): Promise<AIGenerateResult> {
//     logger.agent("Calling DeepSeek chat completions", {
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
//       return await this.callDeepSeek(messages, tools, systemInstruction);
//     } catch (err) {
//       const isRateLimit =
//         err instanceof RateLimitError ||
//         (err instanceof Error &&
//           (err.message.includes("429") || err.message.includes("rate_limit")));

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

//   private async callDeepSeek(
//     messages: AIMessage[],
//     tools: AIFunctionDeclaration[],
//     systemInstruction: string,
//   ): Promise<AIGenerateResult> {
//     const openAIMessages = this.convertMessages(messages, systemInstruction);

//     const openAITools = tools.map((t) => ({
//       type: "function",
//       function: {
//         name: t.name,
//         description: t.description,
//         parameters: t.parameters,
//       },
//     }));

//     const body: Record<string, unknown> = {
//       model: DEEPSEEK_MODEL,
//       messages: openAIMessages,
//     };
//     if (openAITools.length > 0) {
//       body.tools = openAITools;
//       body.tool_choice = "auto";
//     }

//     const response = await fetch(DEEPSEEK_API_URL, {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//         Authorization: `Bearer ${this.apiKey}`,
//       },
//       body: JSON.stringify(body),
//     });

//     if (response.status === 429) throw new RateLimitError("DeepSeek");
//     if (!response.ok) {
//       const errText = await response.text();
//       throw new AIProviderError(
//         `DeepSeek API error ${response.status}: ${errText}`,
//       );
//     }

//     // deno-lint-ignore no-explicit-any
//     const data = (await response.json()) as any;
//     const choice = data.choices?.[0];
//     const message = choice?.message;

//     const functionCalls: Array<{
//       name: string;
//       args: Record<string, unknown>;
//     }> = [];
//     if (message?.tool_calls?.length) {
//       for (const tc of message.tool_calls) {
//         if (tc.type === "function") {
//           try {
//             functionCalls.push({
//               name: tc.function.name,
//               args: JSON.parse(tc.function.arguments ?? "{}"),
//             });
//           } catch {
//             logger.warn(
//               `Failed to parse tool_call args for ${tc.function.name}`,
//             );
//           }
//         }
//       }
//     }

//     return {
//       text: message?.content ?? null,
//       functionCalls,
//       finishReason: choice?.finish_reason ?? "stop",
//     };
//   }

//   // Same conversion logic as OpenAI (both use the same wire format)
//   private convertMessages(
//     messages: AIMessage[],
//     systemInstruction: string,
//   ): unknown[] {
//     const result: unknown[] = [{ role: "system", content: systemInstruction }];
//     for (const msg of messages) {
//       for (const part of msg.parts) {
//         if ("text" in part) {
//           result.push({
//             role: msg.role === "model" ? "assistant" : "user",
//             content: part.text,
//           });
//         } else if ("functionCall" in part) {
//           result.push({
//             role: "assistant",
//             content: null,
//             tool_calls: [
//               {
//                 type: "function",
//                 id: `call_${part.functionCall.name}_${Date.now()}`,
//                 function: {
//                   name: part.functionCall.name,
//                   arguments: JSON.stringify(part.functionCall.args),
//                 },
//               },
//             ],
//           });
//         } else if ("functionResponse" in part) {
//           result.push({
//             role: "tool",
//             tool_call_id: `call_${part.functionResponse.name}_${Date.now()}`,
//             content: JSON.stringify(part.functionResponse.response),
//           });
//         }
//       }
//     }
//     return result;
//   }

//   private sleep(ms: number): Promise<void> {
//     return new Promise((resolve) => setTimeout(resolve, ms));
//   }
// }

// ============================================================
// agent-chat/ai/providers/DeepSeekClient.ts
// NVIDIA NIM endpoint — model: deepseek-ai/deepseek-v4-pro
// Env var: DEEPSEEK_API_KEY = nvapi-KekYZH...
// ============================================================

import type {
  IAIClient,
  AIMessage,
  AIFunctionDeclaration,
  AIGenerateResult,
} from "../IAIClient.ts";
import { createLogger } from "../../../_shared/logger.ts";
import { AIProviderError, RateLimitError } from "../../../_shared/error.ts";

const logger = createLogger("DeepSeekClient");

const DEEPSEEK_MODEL = "deepseek-ai/deepseek-v4-pro";
const DEEPSEEK_API_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 2000;

export class DeepSeekClient implements IAIClient {
  readonly providerName = "DeepSeek";
  private readonly apiKey: string;

  constructor() {
    const apiKey = Deno.env.get("DEEPSEEK_API_KEY");
    if (!apiKey)
      throw new AIProviderError(
        "DEEPSEEK_API_KEY environment variable is not set",
      );
    this.apiKey = apiKey;
    logger.info("DeepSeekClient initialized", { model: DEEPSEEK_MODEL });
  }

  async generateWithTools(
    messages: AIMessage[],
    tools: AIFunctionDeclaration[],
    systemInstruction: string,
  ): Promise<AIGenerateResult> {
    logger.agent("Calling DeepSeek chat completions", {
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
      return await this.callDeepSeek(messages, tools, systemInstruction);
    } catch (err) {
      const isRateLimit =
        err instanceof RateLimitError ||
        (err instanceof Error &&
          (err.message.includes("429") || err.message.includes("rate_limit")));

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

  private async callDeepSeek(
    messages: AIMessage[],
    tools: AIFunctionDeclaration[],
    systemInstruction: string,
  ): Promise<AIGenerateResult> {
    const openAIMessages = this.convertMessages(messages, systemInstruction);

    const openAITools = tools.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));

    const body: Record<string, unknown> = {
      model: DEEPSEEK_MODEL,
      messages: openAIMessages,
      temperature: 1,
      top_p: 0.95,
      max_tokens: 16384,
      stream: false,
      // Disable thinking mode — we need structured tool call responses, not reasoning traces
      chat_template_kwargs: { thinking: false },
    };
    if (openAITools.length > 0) {
      body.tools = openAITools;
      body.tool_choice = "auto";
    }

    const response = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (response.status === 429) throw new RateLimitError("DeepSeek");
    if (!response.ok) {
      const errText = await response.text();
      throw new AIProviderError(
        `DeepSeek API error ${response.status}: ${errText}`,
      );
    }

    // deno-lint-ignore no-explicit-any
    const data = (await response.json()) as any;
    const choice = data.choices?.[0];
    const message = choice?.message;

    const functionCalls: Array<{
      name: string;
      args: Record<string, unknown>;
    }> = [];
    if (message?.tool_calls?.length) {
      for (const tc of message.tool_calls) {
        if (tc.type === "function") {
          try {
            functionCalls.push({
              name: tc.function.name,
              args: JSON.parse(tc.function.arguments ?? "{}"),
            });
          } catch {
            logger.warn(
              `Failed to parse tool_call args for ${tc.function.name}`,
            );
          }
        }
      }
    }

    return {
      text: message?.content ?? null,
      functionCalls,
      finishReason: choice?.finish_reason ?? "stop",
    };
  }

  private convertMessages(
    messages: AIMessage[],
    systemInstruction: string,
  ): unknown[] {
    const result: unknown[] = [{ role: "system", content: systemInstruction }];
    for (const msg of messages) {
      for (const part of msg.parts) {
        if ("text" in part) {
          result.push({
            role: msg.role === "model" ? "assistant" : "user",
            content: part.text,
          });
        } else if ("functionCall" in part) {
          result.push({
            role: "assistant",
            content: null,
            tool_calls: [
              {
                type: "function",
                id: `call_${part.functionCall.name}_${Date.now()}`,
                function: {
                  name: part.functionCall.name,
                  arguments: JSON.stringify(part.functionCall.args),
                },
              },
            ],
          });
        } else if ("functionResponse" in part) {
          result.push({
            role: "tool",
            tool_call_id: `call_${part.functionResponse.name}_${Date.now()}`,
            content: JSON.stringify(part.functionResponse.response),
          });
        }
      }
    }
    return result;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
