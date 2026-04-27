// ============================================================
// agent-chat/ai/AIProviderChain.ts
// Chain of Responsibility — tries providers in order, falls back on any error
// SOLID: OCP  — add providers by passing them in, never modify this class
//        DIP  — depends only on IAIClient abstraction
//        SRP  — only responsible for fallback routing
// ============================================================

import type {
  IAIClient,
  AIMessage,
  AIFunctionDeclaration,
  AIGenerateResult,
} from "./IAIClient.ts";
import { createLogger } from "../../_shared/logger.ts";

const logger = createLogger("AIProviderChain");

export class AIProviderChain implements IAIClient {
  readonly providerName: string;
  private readonly providers: IAIClient[];

  /**
   * @param providers Ordered list — first is primary, rest are fallbacks.
   *                  At least one provider is required.
   */
  constructor(providers: IAIClient[]) {
    if (providers.length === 0) {
      throw new Error("AIProviderChain requires at least one provider");
    }
    this.providers = providers;
    this.providerName = providers.map((p) => p.providerName).join(" → ");
    logger.info("AIProviderChain initialized", { chain: this.providerName });
  }

  async generateWithTools(
    messages: AIMessage[],
    tools: AIFunctionDeclaration[],
    systemInstruction: string,
  ): Promise<AIGenerateResult> {
    let lastError: unknown;

    for (const provider of this.providers) {
      try {
        logger.agent(`Attempting provider: ${provider.providerName}`);
        const result = await provider.generateWithTools(
          messages,
          tools,
          systemInstruction,
        );
        logger.agent(`Provider succeeded: ${provider.providerName}`);
        return result;
      } catch (err) {
        lastError = err;
        logger.warn(
          `Provider '${provider.providerName}' failed — trying next`,
          { error: err instanceof Error ? err.message : String(err) },
        );
      }
    }

    // All providers exhausted
    logger.error("All AI providers failed", { chain: this.providerName });
    throw new Error(
      `All AI providers failed [${this.providerName}]. Last error: ${
        lastError instanceof Error ? lastError.message : String(lastError)
      }`,
    );
  }
}
