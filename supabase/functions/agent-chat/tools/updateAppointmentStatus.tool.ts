// ============================================================
// agent-chat/tools/updateAppointmentStatus.tool.ts
// Tool 7: Update inquiry or appointment status in the database
// Keeps admin dashboard accurate as the conversation progresses
// ============================================================

import type { ITool, ToolContext, ToolResult } from "./ITool.ts";
import type { FunctionDeclaration } from "../google/IGoogleClient.ts";
import type { InquiryStatus } from "../../_shared/types.ts";
import { createLogger } from "../../_shared/logger.ts";
import { DatabaseError, ValidationError } from "../../_shared/error.ts";

const logger = createLogger("UpdateAppointmentStatusTool");

const VALID_INQUIRY_STATUSES: InquiryStatus[] = [
  "pending",
  "matched",
  "scheduled",
  "failed",
  "cancelled",
];

export class UpdateAppointmentStatusTool implements ITool {
  readonly name = "updateAppointmentStatus";

  readonly declaration: FunctionDeclaration = {
    name: "updateAppointmentStatus",
    description:
      "Update the status of an inquiry or appointment in the database. " +
      "Use this to keep records accurate: e.g. set inquiry to 'matched' after " +
      "finding therapists, 'failed' if the patient couldn't be matched, " +
      "or 'cancelled' if the patient changed their mind.",
    parameters: {
      type: "object",
      properties: {
        inquiryId: {
          type: "string",
          description: "The UUID of the inquiry to update",
        },
        status: {
          type: "string",
          description: "New status to set on the inquiry",
          enum: ["pending", "matched", "scheduled", "failed", "cancelled"],
        },
        matchedTherapistId: {
          type: "string",
          description:
            "UUID of the matched therapist (optional — set when status becomes 'matched')",
        },
        reason: {
          type: "string",
          description: "Optional reason for the status change (e.g. why it failed)",
        },
      },
      required: ["inquiryId", "status"],
    },
  };

  async execute(
    args: Record<string, unknown>,
    context: ToolContext
  ): Promise<ToolResult> {
    logger.tool("UpdateAppointmentStatusTool.execute called", {
      inquiryId: args.inquiryId,
      status: args.status,
      matchedTherapistId: args.matchedTherapistId,
    });

    try {
      if (!args.inquiryId || typeof args.inquiryId !== "string") {
        throw new ValidationError("'inquiryId' is required");
      }

      if (!args.status || typeof args.status !== "string") {
        throw new ValidationError("'status' is required");
      }

      if (!VALID_INQUIRY_STATUSES.includes(args.status as InquiryStatus)) {
        throw new ValidationError(
          `'status' must be one of: ${VALID_INQUIRY_STATUSES.join(", ")}`
        );
      }

      const updatePayload: Record<string, unknown> = {
        status: args.status,
      };

      if (args.matchedTherapistId && typeof args.matchedTherapistId === "string") {
        updatePayload.matched_therapist_id = args.matchedTherapistId;
      }

      logger.db("Updating inquiry status", {
        inquiryId: args.inquiryId,
        newStatus: args.status,
      });

      const { data, error } = await context.supabase
        .from("inquiries")
        .update(updatePayload)
        .eq("id", args.inquiryId)
        .select("id, status, updated_at")
        .single();

      if (error) {
        logger.error("Failed to update inquiry status", { error: error.message });
        throw new DatabaseError(
          `Failed to update inquiry status: ${error.message}`,
          error
        );
      }

      logger.db("Inquiry status updated successfully", {
        inquiryId: data.id,
        status: data.status,
      });

      return {
        success: true,
        data: {
          inquiryId: data.id,
          newStatus: data.status,
          updatedAt: data.updated_at,
          message: `Inquiry status updated to '${data.status}'`,
        },
      };
    } catch (err) {
      logger.error("UpdateAppointmentStatusTool failed", err);
      return {
        success: false,
        error: `Failed to update status: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }
}