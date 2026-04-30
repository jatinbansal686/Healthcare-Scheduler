// ============================================================
// agent-chat/tools/respondToUser.tool.ts
// OCP: New tool — no existing files modified to add this.
//
// PURPOSE: Forces the AI to return structured, typed responses
// instead of free-form text. Eliminates regex-based parsing on
// the frontend by guaranteeing a machine-readable payload.
//
// The AgentOrchestrator intercepts this tool call BEFORE
// executing it — it emits a `structured_message` SSE event and
// returns a synthetic "ok" response so the AI can continue.
// This tool's execute() is therefore a safe no-op fallback.
// ============================================================

import type { ITool, ToolContext, ToolResult } from "./ITool.ts";
import type { FunctionDeclaration } from "../google/IGoogleClient.ts";
import { createLogger } from "../../_shared/logger.ts";

const logger = createLogger("RespondToUserTool");

export class RespondToUserTool implements ITool {
  readonly name = "respondToUser";

  readonly declaration: FunctionDeclaration = {
    name: "respondToUser",
    description:
      "ALWAYS use this tool to send ANY message to the user — never reply with plain text. " +
      "This is the ONLY way to communicate with the patient. " +
      "Use ui_hint to tell the frontend which UI component to render. " +
      "Include slots when showing availability, therapists when listing providers.",
    parameters: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description:
            "The conversational message to show the user. " +
            "When ui_hint is 'slots' or 'therapists', this should be a brief intro line only " +
            "(e.g. 'Here are the available slots:' or 'I found these therapists:'). " +
            "The structured data will render as interactive cards below it.",
        },
        ui_hint: {
          type: "string",
          description:
            "Tells the frontend which UI component to render alongside the message. " +
            "'text'        — plain conversational reply, no cards. " +
            "'slots'       — render interactive slot picker cards (requires slots array). " +
            "'therapists'  — render interactive therapist cards (requires therapists array). " +
            "'confirmation'— render a booking confirmation summary. " +
            "'out_of_scope'— user asked something outside scheduling scope.",
          enum: ["text", "slots", "therapists", "confirmation", "out_of_scope"],
        },
        slots: {
          type: "array",
          description:
            "Required when ui_hint is 'slots'. Each item is a bookable time slot. " +
            "Use EXACT values from checkAvailability tool results.",
          items: {
            type: "object",
            properties: {
              startTime: {
                type: "string",
                description: "ISO 8601 start time from checkAvailability",
              },
              endTime: {
                type: "string",
                description: "ISO 8601 end time from checkAvailability",
              },
              label: {
                type: "string",
                description:
                  "Human-readable label from checkAvailability, e.g. 'Monday, Jan 27 at 3:00 PM'",
              },
              therapistId: {
                type: "string",
                description: "Therapist UUID",
              },
              therapistName: {
                type: "string",
                description: "Therapist display name",
              },
            },
            required: ["startTime", "label", "therapistId", "therapistName"],
          },
        },
        therapists: {
          type: "array",
          description:
            "Required when ui_hint is 'therapists'. Each item is a therapist profile. " +
            "Use EXACT values from findTherapists tool results.",
          items: {
            type: "object",
            properties: {
              id: {
                type: "string",
                description: "Therapist UUID from findTherapists",
              },
              name: {
                type: "string",
                description: "Therapist full name",
              },
              yearsExperience: {
                type: "number",
                description: "Years of experience (years_experience field)",
              },
              specialties: {
                type: "array",
                description: "List of specialty strings",
                items: { type: "string" },
              },
              bio: {
                type: "string",
                description: "Short bio (truncated to 200 chars)",
              },
              sessionTypes: {
                type: "array",
                description: "e.g. ['telehealth', 'in-person']",
                items: { type: "string" },
              },
            },
            required: ["id", "name"],
          },
        },
        confirmation: {
          type: "object",
          description: "Required when ui_hint is 'confirmation'.",
          properties: {
            therapistName: { type: "string" },
            date: {
              type: "string",
              description: "Human-readable date string",
            },
            time: {
              type: "string",
              description: "Human-readable time string",
            },
            appointmentId: { type: "string" },
            meetLink: {
              type: "string",
              description: "Google Meet link if available",
            },
          },
          required: ["therapistName", "date", "time"],
        },
      },
      required: ["message", "ui_hint"],
    },
  };

  // execute() is a safe no-op:
  // AgentOrchestrator intercepts this tool BEFORE calling execute()
  // and emits the structured SSE event directly.
  // This fallback only runs if the orchestrator fails to intercept.
  async execute(
    args: Record<string, unknown>,
    _context: ToolContext,
  ): Promise<ToolResult> {
    logger.warn(
      "RespondToUserTool.execute() called — should have been intercepted by orchestrator",
      { ui_hint: args.ui_hint },
    );
    return {
      success: true,
      data: { intercepted: false, message: args.message },
    };
  }
}
