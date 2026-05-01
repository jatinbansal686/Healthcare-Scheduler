// ============================================================
// agent-chat/tools/getTherapistProfile.tool.ts
// Tool 6: Fetch full therapist profile from DB by ID
// CHANGE: Added fee_info synthesised field so AI can answer
//         cost/charges questions from the profile data it has.
//         All DB queries and existing fields unchanged.
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
      "asks about fees/charges/cost, or before booking to confirm all details. " +
      "The result includes fee_info — use it to answer cost questions directly.",
    parameters: {
      type: "object",
      properties: {
        therapistId: {
          type: "string",
          description:
            "The UUID of the therapist to fetch. Use when you have the ID from findTherapists results.",
        },
        therapistName: {
          type: "string",
          description:
            "Partial or full therapist name. Use when patient mentions a name but you don't have their UUID yet. " +
            "Case-insensitive partial match (e.g. 'Dr. Sarah' will find 'Dr. Sarah Mitchell, Psy.D.').",
        },
      },
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
      const hasId = args.therapistId && typeof args.therapistId === "string";
      const hasName =
        args.therapistName && typeof args.therapistName === "string";

      if (!hasId && !hasName) {
        throw new ValidationError(
          "Either 'therapistId' or 'therapistName' is required",
        );
      }

      let therapistId = args.therapistId as string | undefined;

      // ── Resolve name → ID if no UUID provided ────────────
      if (!hasId && hasName) {
        logger.db("Resolving therapist by name", { name: args.therapistName });
        const { data: found, error: nameErr } = await context.supabase
          .from("therapists")
          .select("id, name")
          .eq("is_active", true)
          .ilike("name", `%${args.therapistName as string}%`)
          .limit(1)
          .single();

        if (nameErr || !found) {
          return {
            success: false,
            error: `No therapist found matching name "${args.therapistName}". Please check the name or use findTherapists to search.`,
          };
        }
        therapistId = found.id;
        logger.db("Resolved name to ID", { name: found.name, id: therapistId });
      }

      logger.db("Fetching therapist profile", { therapistId });

      const { data: therapist, error } = await context.supabase
        .from("therapists")
        .select(
          "id, name, email, bio, photo_url, years_experience, specialties, " +
            "accepted_insurance, languages, session_types, session_duration_minutes, " +
            "availability_timezone, is_active, created_at",
        )
        .eq("id", therapistId!)
        .single();

      if (error || !therapist) {
        throw new DatabaseError(
          `Therapist not found: ${error?.message ?? "no result"}`,
        );
      }

      logger.db("Therapist profile fetched successfully", {
        name: therapist.name,
      });

      // ── Synthesise fee_info from available schema fields ──
      // The DB has no fee column. Build a human-readable summary
      // from accepted_insurance and session_duration_minutes so the
      // AI can answer "what are the charges?" without saying "I don't know".
      const insuranceList: string[] = therapist.accepted_insurance ?? [];
      const acceptsSelfPay = insuranceList.some((i: string) =>
        /self.?pay|private|out.of.pocket/i.test(i),
      );
      const insuranceDisplay = insuranceList
        .filter((i: string) => !/self.?pay/i.test(i))
        .join(", ");

      const feeInfo = [
        insuranceDisplay
          ? `Accepts insurance: ${insuranceDisplay}`
          : "Insurance: contact office for details",
        acceptsSelfPay
          ? "Self-pay accepted (exact rate confirmed at booking)"
          : "Self-pay availability: contact office",
        `Session length: ${therapist.session_duration_minutes ?? 50} minutes`,
        "Exact session fees are confirmed by the office when scheduling",
      ].join(". ");

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
          // Synthesised field — AI uses this to answer fee/cost questions
          fee_info: feeInfo,
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
