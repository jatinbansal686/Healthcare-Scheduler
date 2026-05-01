import type { ITool, ToolContext, ToolResult } from "./ITool.ts";
import type { FunctionDeclaration } from "../google/IGoogleClient.ts";
import { createLogger } from "../../_shared/logger.ts";
import {
  DatabaseError,
  ValidationError,
  CalendarError,
} from "../../_shared/error.ts";

const logger = createLogger("BookAppointmentTool");

// ── Valid appointment_type values — MUST match migration 003 CHECK constraint ──
// appointment_type IN ('individual', 'couples', 'group', 'family')
type ValidAppointmentType = "individual" | "couples" | "group" | "family";
const VALID_APPOINTMENT_TYPES: ValidAppointmentType[] = [
  "individual",
  "couples",
  "group",
  "family",
];

// Map any value Gemini might send to a valid DB enum value.
// Gemini hallucinated "in_person" and "phone" — this function catches all such cases.
function normalizeAppointmentType(raw: unknown): ValidAppointmentType {
  if (typeof raw !== "string") {
    logger.warn(
      "appointmentType is not a string — defaulting to 'individual'",
      { raw },
    );
    return "individual";
  }

  const normalized = raw.toLowerCase().trim();

  // Direct match
  if (VALID_APPOINTMENT_TYPES.includes(normalized as ValidAppointmentType)) {
    return normalized as ValidAppointmentType;
  }

  // Map known Gemini hallucinations to correct values
  const mapping: Record<string, ValidAppointmentType> = {
    // "in_person" / "in-person" → individual (most common session type)
    in_person: "individual",
    "in-person": "individual",
    inperson: "individual",
    individual_therapy: "individual",
    single: "individual",
    solo: "individual",
    // phone / video / telehealth are session format, not appointment type
    phone: "individual",
    telehealth: "individual",
    video: "individual",
    online: "individual",
    virtual: "individual",
    // couples-adjacent
    couples_therapy: "couples",
    couple: "couples",
    marriage: "couples",
    relationship: "couples",
    // family-adjacent
    family_therapy: "family",
    families: "family",
    // group-adjacent
    group_therapy: "group",
  };

  if (mapping[normalized]) {
    logger.warn(
      `appointmentType '${raw}' is not a valid DB value — mapped to '${mapping[normalized]}'`,
    );
    return mapping[normalized];
  }

  // Fallback — safest default
  logger.warn(`Unknown appointmentType '${raw}' — defaulting to 'individual'`);
  return "individual";
}

export class BookAppointmentTool implements ITool {
  readonly name = "bookAppointment";

  readonly declaration: FunctionDeclaration = {
    name: "bookAppointment",
    description:
      "Book an appointment by creating a Google Calendar event on the therapist's calendar " +
      "AND saving the appointment record in the database with 'pending' status. " +
      "The appointment becomes confirmed only after the therapist approves via email. " +
      "Call this only after the patient has confirmed a specific time slot. " +
      "After this succeeds, ALWAYS call notifyTherapist next, then sendConfirmation.",
    parameters: {
      type: "object",
      properties: {
        inquiryId: {
          type: "string",
          description: "The UUID of the inquiry from saveInquiry",
        },
        therapistId: {
          type: "string",
          description: "The UUID of the chosen therapist",
        },
        patientName: {
          type: "string",
          description: "Patient's name for the calendar event",
        },
        patientIdentifier: {
          type: "string",
          description: "Anonymous patient identifier",
        },
        startTime: {
          type: "string",
          description:
            "Appointment start time (ISO 8601, e.g. '2025-05-01T17:00:00Z')",
        },
        endTime: {
          type: "string",
          description:
            "Appointment end time (ISO 8601, e.g. '2025-05-01T17:50:00Z')",
        },
        // FIX 1: appointmentType now has an explicit enum matching the DB CHECK constraint.
        // Previously this field was absent from the declaration, causing Gemini to guess
        // values like "in_person" and "phone" that violated the constraint.
        appointmentType: {
          type: "string",
          description:
            "Type of therapy session. Use 'individual' for a single patient session (most common). " +
            "'couples' for two partners, 'family' for family sessions, 'group' for group therapy.",
          enum: ["individual", "couples", "group", "family"],
        },
        notes: {
          type: "string",
          description: "Any special notes for the appointment (optional)",
        },
      },
      required: [
        "inquiryId",
        "therapistId",
        "patientName",
        "patientIdentifier",
        "startTime",
        "endTime",
        // appointmentType is intentionally NOT in required — we default to 'individual'
        // so Gemini can omit it and still get a successful booking
      ],
    },
  };

  async execute(
    args: Record<string, unknown>,
    context: ToolContext,
  ): Promise<ToolResult> {
    logger.tool("BookAppointmentTool.execute called", {
      inquiryId: args.inquiryId,
      therapistId: args.therapistId,
      startTime: args.startTime,
      rawAppointmentType: args.appointmentType,
    });

    let calendarEventId: string | null = null;
    let therapistCalendarId: string | null = null;
    let accessToken: string | null = null;

    try {
      // ── Validate required args ─────────────────────────────
      const required = [
        "inquiryId",
        "therapistId",
        "patientName",
        "startTime",
        "endTime",
      ];
      for (const field of required) {
        if (!args[field] || typeof args[field] !== "string") {
          throw new ValidationError(
            `'${field}' is required and must be a string`,
          );
        }
      }

      // ── Validate datetime formats ──────────────────────────
      const start = new Date(args.startTime as string);
      const end = new Date(args.endTime as string);

      if (isNaN(start.getTime())) {
        throw new ValidationError(
          "'startTime' is not a valid ISO 8601 datetime",
        );
      }
      if (isNaN(end.getTime())) {
        throw new ValidationError("'endTime' is not a valid ISO 8601 datetime");
      }
      if (end <= start) {
        throw new ValidationError("'endTime' must be after 'startTime'");
      }

      // FIX 2: Normalize appointmentType BEFORE any DB operation.
      // This sanitizes hallucinated values ("in_person", "phone", etc.) into
      // a value the DB CHECK constraint will accept.
      const appointmentType = normalizeAppointmentType(args.appointmentType);
      logger.db("Normalized appointmentType", {
        raw: args.appointmentType,
        normalized: appointmentType,
      });

      // ── Fetch therapist details ────────────────────────────
      logger.db("Fetching therapist for booking", {
        therapistId: args.therapistId,
      });

      const { data: therapist, error: therapistError } = await context.supabase
        .from("therapists")
        .select("id, name, email, google_calendar_id, google_refresh_token")
        .eq("id", args.therapistId)
        .single();

      if (therapistError || !therapist) {
        logger.error("Therapist not found", {
          therapistId: args.therapistId,
          error: therapistError?.message,
        });
        throw new DatabaseError(
          `Therapist not found: ${therapistError?.message ?? "unknown"}`,
        );
      }

      logger.db("Therapist fetched", { name: therapist.name });
      therapistCalendarId = therapist.google_calendar_id;

      // ── Step 1: Create Google Calendar event ───────────────
      if (therapist.google_calendar_id && therapist.google_refresh_token) {
        logger.calendar("Creating Google Calendar event");

        try {
          accessToken = await context.tokenRefresher.getAccessToken(
            therapist.google_refresh_token,
          );

          const calendarEvent = {
            summary: `[PENDING] Therapy Session — ${args.patientName}`,
            description:
              `Patient: ${args.patientName}\n` +
              `Patient ID: ${args.patientIdentifier}\n` +
              `Type: ${appointmentType}\n` +
              `Status: Awaiting therapist confirmation\n` +
              (args.notes ? `Notes: ${args.notes}` : ""),
            start: {
              dateTime: args.startTime as string,
              timeZone: "America/Chicago",
            },
            end: {
              dateTime: args.endTime as string,
              timeZone: "America/Chicago",
            },
            status: "tentative",
          };

          const createdEvent = await context.calendarClient.createEvent(
            therapist.google_calendar_id,
            accessToken,
            calendarEvent,
          );

          calendarEventId = createdEvent.id ?? null;
          logger.calendar("Calendar event created successfully", {
            eventId: calendarEventId,
          });
        } catch (calErr) {
          // Non-fatal — we still save the DB record
          logger.error(
            "Calendar event creation failed — proceeding with DB record only",
            calErr,
          );
        }
      } else {
        logger.warn(
          "Therapist has no Google Calendar — skipping calendar event",
        );
      }

      // ── Step 2: Insert appointment into DB ─────────────────
      // appointmentType is now guaranteed to be a valid DB enum value
      logger.db("Inserting appointment into database", { appointmentType });

      const { data: appointment, error: appointmentError } =
        await context.supabase
          .from("appointments")
          .insert({
            inquiry_id: args.inquiryId,
            therapist_id: args.therapistId,
            patient_identifier: args.patientIdentifier,
            start_time: args.startTime,
            end_time: args.endTime,
            google_calendar_event_id: calendarEventId,
            appointment_type: appointmentType, // ← always a valid enum value now
            status: "pending", // ← pending until therapist confirms
            admin_notes: (args.notes as string) || null,
            // confirmation_token + confirmation_token_expires_at auto-set by DB default (migration 008)
          })
          .select(
            "id, start_time, end_time, status, appointment_type, confirmation_token",
          )
          .single();

      if (appointmentError) {
        logger.error("Appointment DB insert failed", {
          error: appointmentError.message,
          code: appointmentError.code,
        });

        // Rollback calendar event if DB insert fails
        if (calendarEventId && therapistCalendarId && accessToken) {
          logger.calendar("Rolling back calendar event due to DB failure", {
            eventId: calendarEventId,
          });
          try {
            await context.calendarClient.deleteEvent(
              therapistCalendarId,
              accessToken,
              calendarEventId,
            );
            logger.calendar("Calendar event rolled back successfully");
          } catch (rollbackErr) {
            logger.error(
              "Calendar rollback also failed — manual cleanup needed",
              {
                eventId: calendarEventId,
                error: rollbackErr,
              },
            );
          }
        }

        throw new DatabaseError(
          `Failed to save appointment: ${appointmentError.message}`,
          appointmentError,
        );
      }

      logger.db("Appointment inserted successfully", {
        appointmentId: appointment.id,
      });

      // ── Step 3: Update inquiry status to 'scheduled' ───────
      logger.db("Updating inquiry status to scheduled", {
        inquiryId: args.inquiryId,
      });

      const { error: updateError } = await context.supabase
        .from("inquiries")
        .update({
          status: "scheduled",
          matched_therapist_id: args.therapistId,
        })
        .eq("id", args.inquiryId);

      if (updateError) {
        // Non-fatal — appointment is already saved
        logger.warn("Failed to update inquiry status (non-fatal)", {
          inquiryId: args.inquiryId,
          error: updateError.message,
        });
      } else {
        logger.db("Inquiry status updated to scheduled");
      }

      logger.tool(
        "BookAppointmentTool completed — pending therapist confirmation",
        {
          appointmentId: appointment.id,
          confirmationToken: appointment.confirmation_token,
          appointmentType,
        },
      );

      return {
        success: true,
        data: {
          appointmentId: appointment.id,
          therapistName: therapist.name,
          therapistEmail: therapist.email, // ← needed by notifyTherapist
          patientName: args.patientName,
          startTime: appointment.start_time,
          endTime: appointment.end_time,
          status: "pending", // ← always pending now
          appointmentType: appointment.appointment_type,
          confirmationToken: appointment.confirmation_token, // ← needed by notifyTherapist
          calendarEventId,
          calendarConnected: !!calendarEventId,
          message:
            "Appointment request submitted. Notifying therapist for confirmation.",
        },
      };
    } catch (err) {
      logger.error("BookAppointmentTool failed", { error: err });
      return {
        success: false,
        error: `Failed to book appointment: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }
}
