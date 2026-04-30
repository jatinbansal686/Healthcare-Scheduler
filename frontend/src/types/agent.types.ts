// // ============================================================
// // agent.types.ts — Types for agent chat, SSE events, tool calls
// // OCP: extended with AvailableSlot — no existing types changed
// // ============================================================

// export type MessageSender = "user" | "agent" | "system";

// // A single bookable time slot parsed from the agent's message text
// export interface AvailableSlot {
//   label: string; // Human-readable: "Tuesday, Apr 28 at 10:00 AM"
//   startTime: string; // ISO 8601 or parseable date string
//   therapistId?: string;
//   therapistName?: string;
// }

// export interface ChatMessage {
//   id: string;
//   sender: MessageSender;
//   text: string;
//   timestamp: string;
//   toolProgress?: ToolProgressEvent[];
//   // Populated when the agent message contains available time slots
//   slots?: AvailableSlot[];
// }

// // ---- SSE event types streamed from the edge function ----

// export type SSEEventType =
//   | "tool_start"
//   | "tool_end"
//   | "text_delta"
//   | "message_complete"
//   | "agent_thinking"
//   | "agent_message"
//   | "done"
//   | "error";

// export interface SSEBaseEvent {
//   type: SSEEventType;
//   data?: Record<string, unknown>;
//   sessionId?: string;
// }

// export interface ToolStartEvent extends SSEBaseEvent {
//   type: "tool_start";
//   toolName: string;
//   toolInput?: Record<string, unknown>;
// }

// export interface ToolEndEvent extends SSEBaseEvent {
//   type: "tool_end";
//   toolName: string;
//   success: boolean;
//   durationMs: number;
// }

// export interface TextDeltaEvent extends SSEBaseEvent {
//   type: "text_delta";
//   delta: string;
// }

// export interface MessageCompleteEvent extends SSEBaseEvent {
//   type: "message_complete";
//   finalText: string;
//   inquiryId?: string;
//   appointmentId?: string;
// }

// export interface AgentMessageEvent extends SSEBaseEvent {
//   type: "agent_message";
//   data: { message: string };
// }

// export interface AgentThinkingEvent extends SSEBaseEvent {
//   type: "agent_thinking";
// }

// export interface DoneEvent extends SSEBaseEvent {
//   type: "done";
//   data: { sessionId: string; toolsUsed: string[]; iterationCount: number };
// }

// export interface ErrorEvent extends SSEBaseEvent {
//   type: "error";
//   code?: string;
//   message?: string;
//   data?: { code: string; message: string };
// }

// export type SSEEvent =
//   | ToolStartEvent
//   | ToolEndEvent
//   | TextDeltaEvent
//   | MessageCompleteEvent
//   | AgentMessageEvent
//   | AgentThinkingEvent
//   | DoneEvent
//   | ErrorEvent;

// // ---- Tool progress displayed in the UI ----

// export interface ToolProgressEvent {
//   toolName: string;
//   status: "running" | "done" | "error";
//   label: string;
//   durationMs?: number;
// }

// // ---- Chat session state ----

// export interface AgentChatState {
//   sessionId: string | null;
//   messages: ChatMessage[];
//   isLoading: boolean;
//   activeTools: ToolProgressEvent[];
//   error: string | null;
// }

// // ---- Request/response shapes for edge function ----

// export interface AgentChatRequest {
//   message: string;
//   sessionId: string | null;
// }

// export interface AgentChatResponse {
//   sessionId: string;
// }

// ============================================================
// agent.types.ts — Types for agent chat, SSE events, tool calls
// CHANGE: Added StructuredMessageData, TherapistOption, ConfirmationData.
//         Added `structuredData` field to ChatMessage.
//         All existing types are 100% unchanged.
// ============================================================

export type MessageSender = "user" | "agent" | "system";

// A single bookable time slot parsed from the agent's message text
export interface AvailableSlot {
  label: string;
  startTime: string;
  endTime?: string;
  therapistId?: string;
  therapistName?: string;
}

// ── Structured data types (from respondToUser tool) ──────────
// These are populated directly from the AI's structured tool call,
// not from regex parsing of message text.

export type UIHint =
  | "text"
  | "slots"
  | "therapists"
  | "confirmation"
  | "out_of_scope";

export interface TherapistOption {
  id: string;
  name: string;
  yearsExperience?: number;
  specialties?: string[];
  bio?: string;
  sessionTypes?: string[];
}

export interface ConfirmationData {
  therapistName: string;
  date: string;
  time: string;
  appointmentId?: string;
  meetLink?: string;
}

// Typed payload attached to agent messages when AI used respondToUser tool.
// When present, the frontend renders UI components directly from this data
// instead of parsing message text with regex.
export interface StructuredMessageData {
  ui_hint: UIHint;
  slots: AvailableSlot[] | null;
  therapists: TherapistOption[] | null;
  confirmation: ConfirmationData | null;
}

export interface ChatMessage {
  id: string;
  sender: MessageSender;
  text: string;
  timestamp: string;
  toolProgress?: ToolProgressEvent[];
  // Legacy: populated by slotParser.ts regex (kept as fallback)
  slots?: AvailableSlot[];
  // New: populated directly from respondToUser tool call (preferred)
  structuredData?: StructuredMessageData;
}

// ---- SSE event types streamed from the edge function ----

export type SSEEventType =
  | "tool_start"
  | "tool_end"
  | "text_delta"
  | "message_complete"
  | "agent_thinking"
  | "agent_message" // legacy — kept for backwards compatibility
  | "structured_message" // new — replaces agent_message with typed payload
  | "done"
  | "error";

export interface SSEBaseEvent {
  type: SSEEventType;
  data?: Record<string, unknown>;
  sessionId?: string;
}

export interface ToolStartEvent extends SSEBaseEvent {
  type: "tool_start";
  toolName: string;
  toolInput?: Record<string, unknown>;
}

export interface ToolEndEvent extends SSEBaseEvent {
  type: "tool_end";
  toolName: string;
  success: boolean;
  durationMs: number;
}

export interface TextDeltaEvent extends SSEBaseEvent {
  type: "text_delta";
  delta: string;
}

export interface MessageCompleteEvent extends SSEBaseEvent {
  type: "message_complete";
  finalText: string;
  inquiryId?: string;
  appointmentId?: string;
}

export interface AgentMessageEvent extends SSEBaseEvent {
  type: "agent_message";
  data: { message: string };
}

// New structured event — AI always sends this via respondToUser tool
export interface StructuredMessageEvent extends SSEBaseEvent {
  type: "structured_message";
  data: {
    message: string;
    ui_hint: UIHint;
    slots: AvailableSlot[] | null;
    therapists: TherapistOption[] | null;
    confirmation: ConfirmationData | null;
  };
}

export interface AgentThinkingEvent extends SSEBaseEvent {
  type: "agent_thinking";
}

export interface DoneEvent extends SSEBaseEvent {
  type: "done";
  data: { sessionId: string; toolsUsed: string[]; iterationCount: number };
}

export interface ErrorEvent extends SSEBaseEvent {
  type: "error";
  code?: string;
  message?: string;
  data?: { code: string; message: string };
}

export type SSEEvent =
  | ToolStartEvent
  | ToolEndEvent
  | TextDeltaEvent
  | MessageCompleteEvent
  | AgentMessageEvent
  | StructuredMessageEvent
  | AgentThinkingEvent
  | DoneEvent
  | ErrorEvent;

// ---- Tool progress displayed in the UI ----

export interface ToolProgressEvent {
  toolName: string;
  status: "running" | "done" | "error";
  label: string;
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
}
