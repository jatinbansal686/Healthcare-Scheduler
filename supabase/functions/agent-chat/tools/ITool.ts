// ============================================================
// agent-chat/tools/ITool.ts
// The contract every tool must implement
// SOLID: OCP — add tools by implementing this interface, never change orchestrator
//        LSP — any ITool can replace any other in the registry array
//        DIP — AgentOrchestrator depends on ITool[], never on concrete tools
// ============================================================

import type { FunctionDeclaration } from "../google/IGoogleClient.ts";

// Context injected into every tool execution — contains all dependencies
export interface ToolContext {
  supabase: ReturnType<typeof import("../../_shared/supabaseAdmin.ts").getSupabaseAdmin>;
  calendarClient: import("../google/IGoogleClient.ts").IGoogleCalendarClient;
  tokenRefresher: import("../google/IGoogleClient.ts").ITokenRefresher;
  sessionId: string;
}

// The result every tool must return
export interface ToolResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

// The interface every tool implements
export interface ITool {
  // Name must exactly match the functionDeclaration name
  readonly name: string;

  // The Gemini function declaration — what the AI sees to decide when to call this tool
  readonly declaration: FunctionDeclaration;

  // Execute the tool with validated args and injected context
  execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult>;
}