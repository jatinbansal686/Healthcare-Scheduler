// // ============================================================
// // agent-chat/ai/providers/OpenAIClient.ts
// // SOLID: OCP — new provider, zero changes to orchestrator or tools
// //        SRP — only responsible for OpenAI API communication
// // ============================================================

// import type {
//   IAIClient,
//   AIMessage,
//   AIFunctionDeclaration,
//   AIGenerateResult,
// } from "../IAIClient.ts";
// import { createLogger } from "../../../_shared/logger.ts";
// import { AIProviderError, RateLimitError } from "../../../_shared/error.ts";

// const logger = createLogger("OpenAIClient");

// const OPENAI_MODEL = "gpt-4o";
// const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
// const MAX_RETRIES = 3;
// const INITIAL_RETRY_DELAY_MS = 2000;

// export class OpenAIClient implements IAIClient {
//   readonly providerName = "OpenAI";
//   private readonly apiKey: string;

//   constructor() {
//     const apiKey = Deno.env.get("OPENAI_API_KEY");
//     if (!apiKey)
//       throw new AIProviderError(
//         "OPENAI_API_KEY environment variable is not set",
//       );
//     this.apiKey = apiKey;
//     logger.info("OpenAIClient initialized", { model: OPENAI_MODEL });
//   }

//   async generateWithTools(
//     messages: AIMessage[],
//     tools: AIFunctionDeclaration[],
//     systemInstruction: string,
//   ): Promise<AIGenerateResult> {
//     logger.agent("Calling OpenAI chat completions", {
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
//       return await this.callOpenAI(messages, tools, systemInstruction);
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

//   private async callOpenAI(
//     messages: AIMessage[],
//     tools: AIFunctionDeclaration[],
//     systemInstruction: string,
//   ): Promise<AIGenerateResult> {
//     // Convert AIMessage[] → OpenAI message format
//     const openAIMessages = this.convertMessages(messages, systemInstruction);

//     // Convert AIFunctionDeclaration[] → OpenAI tool format
//     const openAITools = tools.map((t) => ({
//       type: "function",
//       function: {
//         name: t.name,
//         description: t.description,
//         parameters: t.parameters,
//       },
//     }));

//     const body: Record<string, unknown> = {
//       model: OPENAI_MODEL,
//       messages: openAIMessages,
//     };
//     if (openAITools.length > 0) {
//       body.tools = openAITools;
//       body.tool_choice = "auto";
//     }

//     const response = await fetch(OPENAI_API_URL, {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//         Authorization: `Bearer ${this.apiKey}`,
//       },
//       body: JSON.stringify(body),
//     });

//     if (response.status === 429) {
//       throw new RateLimitError("OpenAI");
//     }
//     if (!response.ok) {
//       const errText = await response.text();
//       throw new AIProviderError(
//         `OpenAI API error ${response.status}: ${errText}`,
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

//   /**
//    * Converts our provider-agnostic AIMessage[] to OpenAI's message format.
//    * OpenAI uses a flat array: system → user/assistant/tool messages.
//    * Function calls come back as `assistant` messages with tool_calls;
//    * function results come as `tool` role messages.
//    */
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
//           // Model requested a tool call
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
//           // Tool result — OpenAI expects role: "tool"
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
// agent-chat/ai/providers/OpenAIClient.ts
// NVIDIA NIM endpoint — model: openai/gpt-oss-120b
// Env var: OPENAI_API_KEY = nvapi-dKsnfLy...
// ============================================================

import type {
  IAIClient,
  AIMessage,
  AIFunctionDeclaration,
  AIGenerateResult,
} from "../IAIClient.ts";
import { createLogger } from "../../../_shared/logger.ts";
import { AIProviderError, RateLimitError } from "../../../_shared/error.ts";

const logger = createLogger("OpenAIClient");

const OPENAI_MODEL = "openai/gpt-oss-120b";
const OPENAI_API_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 2000;

export class OpenAIClient implements IAIClient {
  readonly providerName = "OpenAI";
  private readonly apiKey: string;

  constructor() {
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey)
      throw new AIProviderError(
        "OPENAI_API_KEY environment variable is not set",
      );
    this.apiKey = apiKey;
    logger.info("OpenAIClient initialized", { model: OPENAI_MODEL });
  }

  async generateWithTools(
    messages: AIMessage[],
    tools: AIFunctionDeclaration[],
    systemInstruction: string,
  ): Promise<AIGenerateResult> {
    logger.agent("Calling OpenAI chat completions", {
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
      return await this.callOpenAI(messages, tools, systemInstruction);
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

  private async callOpenAI(
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
      model: OPENAI_MODEL,
      messages: openAIMessages,
      temperature: 1,
      top_p: 1,
      max_tokens: 4096,
      stream: false,
    };
    if (openAITools.length > 0) {
      body.tools = openAITools;
      body.tool_choice = "auto";
    }

    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (response.status === 429) throw new RateLimitError("OpenAI");
    if (!response.ok) {
      const errText = await response.text();
      throw new AIProviderError(
        `OpenAI API error ${response.status}: ${errText}`,
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
