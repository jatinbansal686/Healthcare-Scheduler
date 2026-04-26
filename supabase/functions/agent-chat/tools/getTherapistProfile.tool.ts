// ============================================================
// agent-chat/tools/getTherapistProfile.tool.ts
// Tool 6: Fetch full therapist profile from DB by ID
// ============================================================

import type { ITool, ToolContext, ToolResult } from "./ITool.ts";
import type { FunctionDeclaration } from "../google/IGoogleClient.ts";
import { createLogger } from "../../_shared/logger.ts";
import { DatabaseError, ValidationError } from "../../_shared/error.ts";

const logger = createLogger("GetTherapistProfileTool");

export class GetTherapistProfileTool implements ITool {
  readonly name = "getTherapistProfile";

  readonly declaration: FunctionDeclaration = {
    name: "getTherapistProfile",
    description:
      "Fetch the full profile of a specific therapist from the database. " +
      "Use this when a patient asks for more details about a therapist, " +
      "or before booking to confirm all details are correct.",
    parameters: {
      type: "object",
      properties: {
        therapistId: {
          type: "string",
          description: "The UUID of the therapist to fetch",
        },
      },
      required: ["therapistId"],
    },
  };

  async execute(
    args: Record<string, unknown>,
    context: ToolContext,
  ): Promise<ToolResult> {
    logger.tool("GetTherapistProfileTool.execute called", {
      therapistId: args.therapistId,
    });

    try {
      if (!args.therapistId || typeof args.therapistId !== "string") {
        throw new ValidationError("'therapistId' is required");
      }

      logger.db("Fetching therapist profile", {
        therapistId: args.therapistId,
      });

      // Actual therapists columns (no title, no phone, no profile_image_url,
      // no is_accepting_patients — use is_active instead, photo_url not profile_image_url)
      const { data: therapist, error } = await context.supabase
        .from("therapists")
        .select(
          "id, name, email, bio, photo_url, years_experience, specialties, " +
            "accepted_insurance, languages, session_types, session_duration_minutes, " +
            "availability_timezone, is_active, created_at",
        )
        .eq("id", args.therapistId)
        .single();

      if (error || !therapist) {
        throw new DatabaseError(
          `Therapist not found: ${error?.message ?? "no result"}`,
        );
      }

      logger.db("Therapist profile fetched successfully", {
        name: therapist.name,
      });

      return {
        success: true,
        data: {
          id: therapist.id,
          name: therapist.name,
          email: therapist.email,
          bio: therapist.bio,
          photo_url: therapist.photo_url,
          years_experience: therapist.years_experience,
          specialties: therapist.specialties,
          accepted_insurance: therapist.accepted_insurance,
          languages: therapist.languages,
          session_types: therapist.session_types,
          session_duration_minutes: therapist.session_duration_minutes,
          availability_timezone: therapist.availability_timezone,
          is_active: therapist.is_active,
        },
      };
    } catch (err) {
      logger.error("GetTherapistProfileTool failed", err);
      return {
        success: false,
        error: `Failed to get therapist profile: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }
}
