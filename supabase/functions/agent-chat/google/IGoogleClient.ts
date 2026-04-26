// ============================================================
// agent-chat/google/IGoogleClient.ts
// Interfaces for all external Google services
// SOLID: DIP — depend on abstractions, not on concrete SDK implementations
// ============================================================

import type { GeminiMessage } from "../../_shared/types.ts";

// ── Gemini AI interface ───────────────────────────────────────

export interface FunctionDeclaration {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, ParameterSchema>;
    required: string[];
  };
}

export interface ParameterSchema {
  type: "string" | "number" | "boolean" | "array" | "object";
  description: string;
  enum?: string[];
  items?: { type: string };
  properties?: Record<string, ParameterSchema>;
}

export interface GenerateResult {
  text: string | null;
  functionCalls: Array<{
    name: string;
    args: Record<string, unknown>;
  }>;
  finishReason: string;
}

// The abstraction all orchestrator code depends on — never import GoogleAIClient directly
export interface IGoogleAIClient {
  generateWithTools(
    messages: GeminiMessage[],
    tools: FunctionDeclaration[],
    systemInstruction: string
  ): Promise<GenerateResult>;
}

// ── Google Calendar interface ─────────────────────────────────

export interface CalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  start: { dateTime: string; timeZone?: string };
  end: { dateTime: string; timeZone?: string };
  attendees?: Array<{ email: string }>;
}

export interface FreeBusySlot {
  start: string;
  end: string;
}

export interface IGoogleCalendarClient {
  listEvents(
    calendarId: string,
    accessToken: string,
    timeMin: string,
    timeMax: string
  ): Promise<CalendarEvent[]>;

  createEvent(
    calendarId: string,
    accessToken: string,
    event: CalendarEvent
  ): Promise<CalendarEvent>;

  deleteEvent(
    calendarId: string,
    accessToken: string,
    eventId: string
  ): Promise<void>;

  getFreeBusy(
    calendarId: string,
    accessToken: string,
    timeMin: string,
    timeMax: string
  ): Promise<FreeBusySlot[]>;
}

// ── OAuth token refresher interface ──────────────────────────

export interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

export interface ITokenRefresher {
  getAccessToken(refreshToken: string): Promise<string>;
}