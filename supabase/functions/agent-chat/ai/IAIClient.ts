// ============================================================
// agent-chat/ai/IAIClient.ts
// SOLID: DIP — AgentOrchestrator depends on this abstraction, never on concrete providers
//        OCP — add providers by implementing this, never modify orchestrator
// ============================================================

// Provider-agnostic message format (superset of Gemini's GeminiMessage)
export interface AIMessage {
  role: "user" | "model";
  parts: AIPart[];
}

export type AIPart =
  | { text: string }
  | { functionCall: { name: string; args: Record<string, unknown> } }
  | { functionResponse: { name: string; response: Record<string, unknown> } };

// Provider-agnostic tool declaration
export interface AIFunctionDeclaration {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
}

// Provider-agnostic result
export interface AIGenerateResult {
  text: string | null;
  functionCalls: Array<{ name: string; args: Record<string, unknown> }>;
  finishReason: string;
}

// The single abstraction the orchestrator depends on
export interface IAIClient {
  readonly providerName: string;
  generateWithTools(
    messages: AIMessage[],
    tools: AIFunctionDeclaration[],
    systemInstruction: string,
  ): Promise<AIGenerateResult>;
}
