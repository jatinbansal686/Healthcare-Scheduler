// ============================================================
// agent-chat/tools/sendConfirmation.tool.ts
// Tool 8: Format and return the final booking confirmation
// Ensures every confirmation is consistent and complete
// ============================================================

import type { ITool, ToolContext, ToolResult } from "./ITool.ts";
import type { FunctionDeclaration } from "../google/IGoogleClient.ts";
import { createLogger } from "../../_shared/logger.ts";
import { ValidationError } from "../../_shared/error.ts";

const logger = createLogger("SendConfirmationTool");

export class SendConfirmationTool implements ITool {
  readonly name = "sendConfirmation";

  readonly declaration: FunctionDeclaration = {
    name: "sendConfirmation",
    description:
      "Generate a structured confirmation message after a successful booking. " +
      "Call this as the FINAL step after notifyTherapist completes. " +
      "The appointment is PENDING therapist confirmation — the message must reflect this. " +
      "Do NOT say 'confirmed' — say the request has been sent and therapist will confirm within 24 hours.",
    parameters: {
      type: "object",
      properties: {
        appointmentId: {
          type: "string",
          description: "UUID of the confirmed appointment",
        },
        therapistName: {
          type: "string",
          description: "Full name and title of the therapist",
        },
        patientName: {
          type: "string",
          description: "Patient's name",
        },
        startTime: {
          type: "string",
          description: "Appointment start time (ISO 8601)",
        },
        endTime: {
          type: "string",
          description: "Appointment end time (ISO 8601)",
        },
        sessionType: {
          type: "string",
          description: "Type of session",
          enum: ["in-person", "telehealth"],
        },
        calendarEventCreated: {
          type: "boolean",
          description:
            "Whether a Google Calendar event was successfully created",
        },
        therapistPhone: {
          type: "string",
          description: "Therapist's phone number if available (optional)",
        },
      },
      required: [
        "appointmentId",
        "therapistName",
        "patientName",
        "startTime",
        "endTime",
        "sessionType",
        "calendarEventCreated",
      ],
    },
  };

  async execute(
    args: Record<string, unknown>,
    _context: ToolContext,
  ): Promise<ToolResult> {
    logger.tool("SendConfirmationTool.execute called", {
      appointmentId: args.appointmentId,
      therapistName: args.therapistName,
      startTime: args.startTime,
    });

    try {
      // Validate required fields
      const required = [
        "appointmentId",
        "therapistName",
        "patientName",
        "startTime",
        "endTime",
      ];
      for (const field of required) {
        if (!args[field]) {
          throw new ValidationError(`'${field}' is required`);
        }
      }

      const startDate = new Date(args.startTime as string);
      const endDate = new Date(args.endTime as string);

      if (isNaN(startDate.getTime())) {
        throw new ValidationError("'startTime' is not a valid datetime");
      }

      // Format the confirmation details
      const formattedDate = startDate.toLocaleString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      });

      const durationMinutes = Math.round(
        (endDate.getTime() - startDate.getTime()) / 60000,
      );

      const confirmationDetails = {
        appointmentId: args.appointmentId,
        summary: {
          therapist: args.therapistName,
          patient: args.patientName,
          dateTime: formattedDate,
          duration: `${durationMinutes} minutes`,
          sessionType: args.sessionType,
        },
        calendarStatus: args.calendarEventCreated
          ? "📅 Tentatively added to therapist's calendar — will confirm upon approval"
          : "📅 Calendar will be updated once therapist confirms",
        nextSteps: [
          `${args.therapistName} has been notified and will confirm within 24 hours`,
          "You will be notified once the therapist confirms your appointment",
          "If not confirmed within 24 hours, the request will be automatically cancelled",
          args.therapistPhone
            ? `Questions? Call ${args.therapistPhone}`
            : "For urgent changes, please contact the office directly",
        ],
        confirmationMessage:
          `⏳ Appointment Request Submitted!\n\n` +
          `Hi ${args.patientName}, your appointment request has been sent to ${args.therapistName}!\n\n` +
          `📋 Details:\n` +
          `• Therapist: ${args.therapistName}\n` +
          `• Date & Time: ${formattedDate}\n` +
          `• Duration: ${durationMinutes} minutes\n` +
          `• Session Type: ${args.sessionType === "telehealth" ? "🖥️ Telehealth" : "🏥 In-Person"}\n\n` +
          `📬 ${args.therapistName} has been notified and will confirm your appointment within 24 hours. ` +
          `If they don't respond in time, the request will be automatically cancelled and you can try another slot.\n\n` +
          `Is there anything else I can help you with?`,
      };

      logger.tool("Confirmation generated successfully", {
        appointmentId: args.appointmentId,
      });

      return {
        success: true,
        data: confirmationDetails,
      };
    } catch (err) {
      logger.error("SendConfirmationTool failed", err);
      return {
        success: false,
        error: `Failed to send confirmation: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }
}
