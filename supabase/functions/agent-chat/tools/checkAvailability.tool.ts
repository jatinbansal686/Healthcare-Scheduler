// ============================================================
// agent-chat/tools/checkAvailability.tool.ts
// Tool 4: Check therapist availability via Google Calendar API
// ============================================================

import type { ITool, ToolContext, ToolResult } from "./ITool.ts";
import type { FunctionDeclaration } from "../google/IGoogleClient.ts";
import { createLogger } from "../../_shared/logger.ts";
import {
  DatabaseError,
  ValidationError,
  CalendarError,
} from "../../_shared/error.ts";

const logger = createLogger("CheckAvailabilityTool");

const SESSION_DURATION_MINUTES = 50;
const BUSINESS_HOURS = { start: 8, end: 20 };

export class CheckAvailabilityTool implements ITool {
  readonly name = "checkAvailability";

  readonly declaration: FunctionDeclaration = {
    name: "checkAvailability",
    description:
      "Check a therapist's real-time availability by querying their Google Calendar. " +
      "Returns available time slots within the requested window. " +
      "Call this after findTherapists to show the patient actual open slots.",
    parameters: {
      type: "object",
      properties: {
        therapistId: {
          type: "string",
          description: "The UUID of the therapist from findTherapists results",
        },
        startDate: {
          type: "string",
          description: "Start of the availability search window (ISO 8601)",
        },
        endDate: {
          type: "string",
          description: "End of the availability search window (ISO 8601)",
        },
        preferredTimes: {
          type: "string",
          description:
            "Patient's time preferences. Examples: 'mornings', 'evenings', 'weekdays', 'any'",
        },
      },
      required: ["therapistId", "startDate", "endDate"],
    },
  };

  async execute(
    args: Record<string, unknown>,
    context: ToolContext,
  ): Promise<ToolResult> {
    logger.tool("CheckAvailabilityTool.execute called", {
      therapistId: args.therapistId,
      startDate: args.startDate,
      endDate: args.endDate,
    });

    try {
      if (!args.therapistId || typeof args.therapistId !== "string") {
        throw new ValidationError("'therapistId' is required");
      }
      if (!args.startDate || typeof args.startDate !== "string") {
        throw new ValidationError("'startDate' is required");
      }
      if (!args.endDate || typeof args.endDate !== "string") {
        throw new ValidationError("'endDate' is required");
      }

      // Actual therapists columns: no title, no phone
      // google_calendar_id and google_refresh_token exist ✓
      logger.db("Fetching therapist calendar credentials", {
        therapistId: args.therapistId,
      });

      const { data: therapist, error: therapistError } = await context.supabase
        .from("therapists")
        .select(
          "id, name, google_calendar_id, google_refresh_token, session_duration_minutes",
        )
        .eq("id", args.therapistId)
        .single();

      if (therapistError || !therapist) {
        throw new DatabaseError(
          `Therapist not found: ${therapistError?.message ?? "unknown error"}`,
        );
      }

      const sessionDuration =
        therapist.session_duration_minutes ?? SESSION_DURATION_MINUTES;

      if (!therapist.google_calendar_id || !therapist.google_refresh_token) {
        logger.warn("Therapist has no Google Calendar connected", {
          name: therapist.name,
        });
        return {
          success: true,
          data: {
            therapistId: args.therapistId,
            therapistName: therapist.name,
            availableSlots: this.generateSimulatedSlots(
              args.startDate as string,
              args.endDate as string,
              args.preferredTimes as string,
              sessionDuration,
            ),
            isSimulated: true,
            note: `${therapist.name} hasn't connected their calendar yet. Showing estimated availability — actual confirmation will be by phone.`,
          },
        };
      }

      logger.calendar("Getting access token for therapist calendar");
      let accessToken: string;
      try {
        accessToken = await context.tokenRefresher.getAccessToken(
          therapist.google_refresh_token,
        );
      } catch (err) {
        throw new CalendarError(
          `Could not authenticate with therapist's calendar: ${err instanceof Error ? err.message : String(err)}`,
          err,
        );
      }

      logger.calendar("Fetching busy slots from Google Calendar");
      const busySlots = await context.calendarClient.getFreeBusy(
        therapist.google_calendar_id,
        accessToken,
        args.startDate as string,
        args.endDate as string,
      );

      const availableSlots = this.computeAvailableSlots(
        args.startDate as string,
        args.endDate as string,
        busySlots.map((s) => ({ start: s.start, end: s.end })),
        args.preferredTimes as string | undefined,
        sessionDuration,
      );

      logger.tool(
        `CheckAvailability complete — ${availableSlots.length} slots available`,
      );

      return {
        success: true,
        data: {
          therapistId: args.therapistId,
          therapistName: therapist.name,
          availableSlots,
          isSimulated: false,
          totalSlotsFound: availableSlots.length,
          searchWindow: { start: args.startDate, end: args.endDate },
        },
      };
    } catch (err) {
      logger.error("CheckAvailabilityTool failed", err);
      return {
        success: false,
        error: `Failed to check availability: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  private computeAvailableSlots(
    startDate: string,
    endDate: string,
    busySlots: Array<{ start: string; end: string }>,
    preferredTimes?: string,
    sessionDuration = SESSION_DURATION_MINUTES,
  ): Array<{ start: string; end: string; label: string }> {
    const slots: Array<{ start: string; end: string; label: string }> = [];
    const windowEnd = new Date(endDate);
    const durationMs = sessionDuration * 60 * 1000;

    const sorted = [...busySlots].sort(
      (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
    );

    const current = new Date(startDate);
    current.setHours(BUSINESS_HOURS.start, 0, 0, 0);

    while (current < windowEnd && slots.length < 8) {
      if (current.getDay() === 0) {
        current.setDate(current.getDate() + 1);
        current.setHours(BUSINESS_HOURS.start, 0, 0, 0);
        continue;
      }

      const dayEnd = new Date(current);
      dayEnd.setHours(BUSINESS_HOURS.end, 0, 0, 0);
      const slotTime = new Date(current);

      while (slotTime < dayEnd && slots.length < 8) {
        const slotEnd = new Date(slotTime.getTime() + durationMs);
        const isBusy = sorted.some((busy) => {
          const bs = new Date(busy.start);
          const be = new Date(busy.end);
          return slotTime < be && slotEnd > bs;
        });

        if (!isBusy && this.matchesPreference(slotTime, preferredTimes)) {
          slots.push({
            start: slotTime.toISOString(),
            end: slotEnd.toISOString(),
            label: this.formatSlotLabel(slotTime),
          });
        }
        slotTime.setMinutes(slotTime.getMinutes() + 30);
      }

      current.setDate(current.getDate() + 1);
      current.setHours(BUSINESS_HOURS.start, 0, 0, 0);
    }

    return slots;
  }

  private matchesPreference(slotTime: Date, preference?: string): boolean {
    if (!preference || preference === "any") return true;
    const hour = slotTime.getHours();
    const day = slotTime.getDay();
    if (preference.includes("morning") && (hour < 9 || hour >= 12))
      return false;
    if (preference.includes("afternoon") && (hour < 12 || hour >= 17))
      return false;
    if (preference.includes("evening") && (hour < 17 || hour >= 20))
      return false;
    if (preference.includes("weekday") && (day === 0 || day === 6))
      return false;
    if (preference.includes("weekend") && day !== 0 && day !== 6) return false;
    return true;
  }

  private formatSlotLabel(date: Date): string {
    return date.toLocaleString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });
  }

  private generateSimulatedSlots(
    startDate: string,
    _endDate: string,
    preferredTimes?: string,
    sessionDuration = SESSION_DURATION_MINUTES,
  ) {
    const start = new Date(startDate);
    const slots = [];
    const hours = preferredTimes?.includes("evening")
      ? [17, 18, 19]
      : [9, 10, 14, 15];

    for (let day = 1; day <= 5 && slots.length < 6; day++) {
      const date = new Date(start);
      date.setDate(date.getDate() + day);
      if (date.getDay() === 0 || date.getDay() === 6) continue;

      for (const hour of hours) {
        date.setHours(hour, 0, 0, 0);
        const end = new Date(date.getTime() + sessionDuration * 60 * 1000);
        slots.push({
          start: date.toISOString(),
          end: end.toISOString(),
          label: this.formatSlotLabel(date),
        });
      }
    }
    return slots;
  }
}
