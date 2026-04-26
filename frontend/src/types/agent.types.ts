// ============================================================
// agent.types.ts — Types for agent chat, SSE events, tool calls
// ============================================================

export type MessageSender = 'user' | 'agent' | 'system';

export interface ChatMessage {
  id: string;
  sender: MessageSender;
  text: string;
  timestamp: string;
  toolProgress?: ToolProgressEvent[]; // tool calls that happened during this message
}

// ---- SSE event types streamed from the edge function ----

export type SSEEventType =
  | 'tool_start'
  | 'tool_end'
  | 'text_delta'
  | 'message_complete'
  | 'error';

export interface SSEBaseEvent {
  type: SSEEventType;
  sessionId: string;
}

export interface ToolStartEvent extends SSEBaseEvent {
  type: 'tool_start';
  toolName: string;
  toolInput: Record<string, unknown>;
}

export interface ToolEndEvent extends SSEBaseEvent {
  type: 'tool_end';
  toolName: string;
  success: boolean;
  durationMs: number;
}

export interface TextDeltaEvent extends SSEBaseEvent {
  type: 'text_delta';
  delta: string;
}

export interface MessageCompleteEvent extends SSEBaseEvent {
  type: 'message_complete';
  finalText: string;
  inquiryId?: string;
  appointmentId?: string;
}

export interface ErrorEvent extends SSEBaseEvent {
  type: 'error';
  code: string;
  message: string;
}

export type SSEEvent =
  | ToolStartEvent
  | ToolEndEvent
  | TextDeltaEvent
  | MessageCompleteEvent
  | ErrorEvent;

// ---- Tool progress displayed in the UI ----

export interface ToolProgressEvent {
  toolName: string;
  status: 'running' | 'done' | 'error';
  label: string; // human-readable: "Checking Dr. Rivera's calendar…"
  durationMs?: number;
}

// ---- Chat session state ----

export interface AgentChatState {
  sessionId: string | null;
  messages: ChatMessage[];
  isLoading: boolean;
  activeTools: ToolProgressEvent[];
  error: string | null;
}

// ---- Request/response shapes for edge function ----

export interface AgentChatRequest {
  message: string;
  sessionId: string | null;
}

export interface AgentChatResponse {
  sessionId: string;
  // SSE stream — handled by EventSource, not typed here
}