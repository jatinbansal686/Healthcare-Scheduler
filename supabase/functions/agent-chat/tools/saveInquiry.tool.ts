// ============================================================
// agent-chat/tools/saveInquiry.tool.ts
// Tool 2: Save patient inquiry to the inquiries table
// ============================================================

import type { ITool, ToolContext, ToolResult } from "./ITool.ts";
import type { FunctionDeclaration } from "../google/IGoogleClient.ts";
import { createLogger } from "../../_shared/logger.ts";
import { DatabaseError, ValidationError } from "../../_shared/error.ts";

const logger = createLogger("SaveInquiryTool");

export class SaveInquiryTool implements ITool {
  readonly name = "saveInquiry";

  readonly declaration: FunctionDeclaration = {
    name: "saveInquiry",
    description:
      "Save the patient's inquiry to the database. Call this ONCE after extracting " +
      "structured information. This creates the inquiry record used throughout the session. " +
      "Returns the inquiry_id needed for subsequent operations.",
    parameters: {
      type: "object",
      properties: {
        patientName: {
          type: "string",
          description: "Patient's name, or empty string if not provided",
        },
        patientEmail: {
          type: "string",
          description:
            "Patient's email address. REQUIRED — must be provided before calling this tool.",
        },
        patientIdentifier: {
          type: "string",
          description:
            "Anonymous identifier for the patient. Use 'anonymous' if not available.",
        },
        problemDescription: {
          type: "string",
          description:
            "Full description of the patient's problem as they described it in their own words",
        },
        extractedConditions: {
          type: "array",
          description:
            "Normalized list of conditions extracted from the conversation",
          items: { type: "string" },
        },
        extractedInsurance: {
          type: "string",
          description: "Normalized insurance provider name",
        },
        extractedSchedule: {
          type: "string",
          description: "Patient's scheduling preferences",
        },
      },
      required: [
        "patientIdentifier",
        "patientEmail",
        "problemDescription",
        "extractedConditions",
        "extractedInsurance",
        "extractedSchedule",
      ],
    },
  };

  async execute(
    args: Record<string, unknown>,
    context: ToolContext,
  ): Promise<ToolResult> {
    logger.tool("SaveInquiryTool.execute called", {
      conditions: args.extractedConditions,
      insurance: args.extractedInsurance,
    });

    try {
      if (
        !args.problemDescription ||
        typeof args.problemDescription !== "string"
      ) {
        throw new ValidationError("'problemDescription' is required");
      }
      if (!Array.isArray(args.extractedConditions)) {
        throw new ValidationError("'extractedConditions' must be an array");
      }

      // ── Schema-accurate insert payload ────────────────────
      // Actual inquiries columns (from DB inspection):
      //   id, patient_identifier, problem_description, requested_schedule,
      //   insurance_info, extracted_conditions, primary_specialty,
      //   matched_therapist_id, considered_therapist_ids, status,
      //   raw_chat_summary, failure_reason, agent_loop_count,
      //   extracted_insurance, extracted_schedule, created_at, updated_at
      //
      // NOT in schema: patient_name, session_id
      const patientEmail = (args.patientEmail as string)?.trim() || "";
      const patientName = (args.patientName as string)?.trim() || "";

      const insertPayload = {
        // Use email as the patient identifier so the record is traceable
        patient_identifier:
          patientEmail || (args.patientIdentifier as string) || "anonymous",
        problem_description: args.problemDescription as string,
        extracted_conditions: args.extractedConditions as string[],
        extracted_insurance: (args.extractedInsurance as string) || null,
        extracted_schedule: (args.extractedSchedule as string) || null,
        requested_schedule: (args.extractedSchedule as string) || null,
        insurance_info: (args.extractedInsurance as string) || null,
        primary_specialty:
          Array.isArray(args.extractedConditions) &&
          args.extractedConditions.length > 0
            ? (args.extractedConditions as string[])[0]
            : null,
        // Store both name and email in raw_chat_summary for admin visibility
        raw_chat_summary:
          [
            patientName ? `Patient: ${patientName}` : null,
            patientEmail ? `Email: ${patientEmail}` : null,
          ]
            .filter(Boolean)
            .join(" | ") || null,
        status: "pending",
      };

      logger.db("Inserting inquiry into database");

      const { data, error } = await context.supabase
        .from("inquiries")
        .insert(insertPayload)
        .select("id, status, created_at")
        .single();

      if (error) {
        logger.error("Database insert failed for inquiry", {
          error: error.message,
        });
        throw new DatabaseError(
          `Failed to save inquiry: ${error.message}`,
          error,
        );
      }

      logger.db("Inquiry saved successfully", { inquiryId: data.id });

      return {
        success: true,
        data: {
          inquiryId: data.id,
          status: data.status,
          createdAt: data.created_at,
          message: `Inquiry saved with ID: ${data.id}`,
        },
      };
    } catch (err) {
      logger.error("SaveInquiryTool failed", err);
      return {
        success: false,
        error: `Failed to save inquiry: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }
}
