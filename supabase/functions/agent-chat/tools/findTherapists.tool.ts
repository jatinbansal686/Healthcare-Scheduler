// // ============================================================
// // agent-chat/tools/findTherapists.tool.ts
// // Tool 3: Query DB for matching therapists by specialty + insurance
// // ============================================================

// import type { ITool, ToolContext, ToolResult } from "./ITool.ts";
// import type { FunctionDeclaration } from "../google/IGoogleClient.ts";
// import { createLogger } from "../../_shared/logger.ts";
// import { DatabaseError, ValidationError } from "../../_shared/error.ts";

// const logger = createLogger("FindTherapistsTool");

// export class FindTherapistsTool implements ITool {
//   readonly name = "findTherapists";

//   readonly declaration: FunctionDeclaration = {
//     name: "findTherapists",
//     description:
//       "Search the database for therapists matching the patient's conditions and insurance. " +
//       "Use the normalized conditions and insurance from extractStructuredInfo. " +
//       "Returns a list of matching therapists with their profiles. " +
//       "Always call this before checking availability or booking.",
//     parameters: {
//       type: "object",
//       properties: {
//         conditions: {
//           type: "array",
//           description:
//             "Normalized list of conditions to match against therapist specialties",
//           items: { type: "string" },
//         },
//         insurance: {
//           type: "string",
//           description:
//             "Normalized insurance provider. Use 'any' to skip insurance filtering " +
//             "(e.g. for self-pay patients).",
//         },
//         sessionType: {
//           type: "string",
//           description: "Preferred session type filter",
//           enum: ["in-person", "telehealth", "no-preference"],
//         },
//         limit: {
//           type: "number",
//           description: "Maximum number of therapists to return. Default: 5",
//         },
//       },
//       required: ["conditions", "insurance"],
//     },
//   };

//   async execute(
//     args: Record<string, unknown>,
//     context: ToolContext,
//   ): Promise<ToolResult> {
//     logger.tool("FindTherapistsTool.execute called", {
//       conditions: args.conditions,
//       insurance: args.insurance,
//       sessionType: args.sessionType,
//     });

//     try {
//       if (!Array.isArray(args.conditions) || args.conditions.length === 0) {
//         throw new ValidationError("'conditions' must be a non-empty array");
//       }
//       if (typeof args.insurance !== "string") {
//         throw new ValidationError("'insurance' must be a string");
//       }

//       const conditions = args.conditions as string[];
//       const insurance = args.insurance as string;
//       const sessionType = (args.sessionType as string) || "no-preference";
//       const limit = Math.min((args.limit as number) || 5, 10);

//       logger.db("Querying therapists table", {
//         conditions,
//         insurance,
//         sessionType,
//         limit,
//       });

//       // ── Schema-accurate select ────────────────────────────
//       // Actual therapists columns:
//       //   id, name, email, bio, photo_url, years_experience, specialties,
//       //   accepted_insurance, session_types, languages, google_calendar_id,
//       //   google_refresh_token, session_duration_minutes, availability_timezone,
//       //   is_active, created_at, updated_at
//       //
//       // NOT in schema: title, is_accepting_patients, profile_image_url, phone
//       const SELECT_FIELDS =
//         "id, name, email, bio, photo_url, years_experience, specialties, " +
//         "accepted_insurance, languages, session_types, is_active";

//       let query = context.supabase
//         .from("therapists")
//         .select(SELECT_FIELDS)
//         .eq("is_active", true) // ← was is_accepting_patients
//         .overlaps("specialties", conditions);

//       if (
//         insurance !== "any" &&
//         insurance !== "unknown" &&
//         insurance !== "self-pay"
//       ) {
//         logger.db("Applying insurance filter", { insurance });
//         query = query.contains("accepted_insurance", [insurance]);
//       }

//       if (sessionType !== "no-preference") {
//         logger.db("Applying session type filter", { sessionType });
//         query = query.contains("session_types", [sessionType]);
//       }

//       query = query.limit(limit);

//       const { data: therapists, error } = await query;

//       if (error) {
//         logger.error("Therapist query failed", { error: error.message });
//         throw new DatabaseError(
//           `Failed to query therapists: ${error.message}`,
//           error,
//         );
//       }

//       logger.db(`Found ${therapists?.length ?? 0} matching therapists`);

//       if (!therapists || therapists.length === 0) {
//         // Fallback: drop insurance filter, keep specialty match
//         logger.info(
//           "No exact matches — attempting fallback without insurance filter",
//         );

//         const { data: fallback, error: fallbackError } = await context.supabase
//           .from("therapists")
//           .select(SELECT_FIELDS)
//           .eq("is_active", true)
//           .overlaps("specialties", conditions)
//           .limit(limit);

//         if (fallbackError) {
//           logger.error("Fallback query also failed", {
//             error: fallbackError.message,
//           });
//         }

//         const fallbackResults = fallback ?? [];
//         logger.db(`Fallback found ${fallbackResults.length} therapists`);

//         return {
//           success: true,
//           data: {
//             therapists: this.formatTherapists(fallbackResults),
//             totalFound: fallbackResults.length,
//             searchParams: { conditions, insurance, sessionType },
//             note:
//               fallbackResults.length > 0
//                 ? `No therapists found for insurance '${insurance}', but found ${fallbackResults.length} who specialize in your conditions. They may offer self-pay options.`
//                 : "No therapists found matching your criteria. Consider broadening your search.",
//           },
//         };
//       }

//       return {
//         success: true,
//         data: {
//           therapists: this.formatTherapists(therapists),
//           totalFound: therapists.length,
//           searchParams: { conditions, insurance, sessionType },
//           note: `Found ${therapists.length} therapist(s) matching your needs`,
//         },
//       };
//     } catch (err) {
//       logger.error("FindTherapistsTool failed", err);
//       return {
//         success: false,
//         error: `Failed to find therapists: ${err instanceof Error ? err.message : String(err)}`,
//       };
//     }
//   }

//   // deno-lint-ignore no-explicit-any
//   private formatTherapists(therapists: any[]) {
//     return therapists.map((t) => ({
//       id: t.id,
//       name: t.name,
//       email: t.email,
//       bio: t.bio
//         ? t.bio.slice(0, 200) + (t.bio.length > 200 ? "..." : "")
//         : null,
//       photo_url: t.photo_url, // ← was profile_image_url
//       years_experience: t.years_experience,
//       specialties: t.specialties,
//       accepted_insurance: t.accepted_insurance,
//       languages: t.languages,
//       session_types: t.session_types,
//     }));
//   }
// }

// ============================================================
// agent-chat/tools/findTherapists.tool.ts
// Tool 3: Query DB for matching therapists by specialty + insurance
// ============================================================

import type { ITool, ToolContext, ToolResult } from "./ITool.ts";
import type { FunctionDeclaration } from "../google/IGoogleClient.ts";
import { createLogger } from "../../_shared/logger.ts";
import { DatabaseError, ValidationError } from "../../_shared/error.ts";

const logger = createLogger("FindTherapistsTool");

export class FindTherapistsTool implements ITool {
  readonly name = "findTherapists";

  readonly declaration: FunctionDeclaration = {
    name: "findTherapists",
    description:
      "Search the database for therapists matching the patient's conditions and insurance. " +
      "Use the normalized conditions and insurance from extractStructuredInfo. " +
      "Returns a list of matching therapists with their profiles. " +
      "Always call this before checking availability or booking.",
    parameters: {
      type: "object",
      properties: {
        conditions: {
          type: "array",
          description:
            "Normalized list of conditions to match against therapist specialties",
          items: { type: "string" },
        },
        insurance: {
          type: "string",
          description:
            "Normalized insurance provider. Use 'any' to skip insurance filtering " +
            "(e.g. for self-pay patients).",
        },
        sessionType: {
          type: "string",
          description: "Preferred session type filter",
          enum: ["in-person", "telehealth", "no-preference"],
        },
        limit: {
          type: "number",
          description: "Maximum number of therapists to return. Default: 5",
        },
        therapistName: {
          type: "string",
          description:
            "Partial or full therapist name to search by. Use when the patient mentions " +
            "a specific therapist by name (e.g. 'Dr. Sarah', 'Rivera'). " +
            "Case-insensitive partial match. Leave empty for condition-only search.",
        },
      },
      required: ["conditions", "insurance"],
    },
  };

  async execute(
    args: Record<string, unknown>,
    context: ToolContext,
  ): Promise<ToolResult> {
    logger.tool("FindTherapistsTool.execute called", {
      conditions: args.conditions,
      insurance: args.insurance,
      sessionType: args.sessionType,
    });

    try {
      if (!Array.isArray(args.conditions) || args.conditions.length === 0) {
        throw new ValidationError("'conditions' must be a non-empty array");
      }
      if (typeof args.insurance !== "string") {
        throw new ValidationError("'insurance' must be a string");
      }

      const conditions = args.conditions as string[];
      const insurance = args.insurance as string;
      const sessionType = (args.sessionType as string) || "no-preference";
      const limit = Math.min((args.limit as number) || 5, 10);
      const therapistName = (args.therapistName as string)?.trim() || "";

      // ── Name-based lookup (takes priority over condition search) ──
      // Patient mentioned a specific therapist by partial name.
      if (therapistName) {
        logger.db("Name-based therapist search", { therapistName });
        const { data: byName, error: nameErr } = await context.supabase
          .from("therapists")
          .select(
            "id, name, email, bio, photo_url, years_experience, specialties, " +
              "accepted_insurance, languages, session_types, is_active",
          )
          .eq("is_active", true)
          .ilike("name", `%${therapistName}%`)
          .limit(5);

        if (nameErr) {
          logger.error("Name search failed", { error: nameErr.message });
        } else if (byName && byName.length > 0) {
          logger.db(`Name search found ${byName.length} result(s)`);
          return {
            success: true,
            data: {
              therapists: this.formatTherapists(byName),
              totalFound: byName.length,
              searchParams: {
                therapistName,
                conditions,
                insurance,
                sessionType,
              },
              note: `Found ${byName.length} therapist(s) matching name "${therapistName}"`,
            },
          };
        } else {
          logger.info(
            "Name search returned 0 results — falling through to specialty search",
          );
        }
      }

      logger.db("Querying therapists table", {
        conditions,
        insurance,
        sessionType,
        limit,
      });

      // ── Schema-accurate select ────────────────────────────
      // Actual therapists columns:
      //   id, name, email, bio, photo_url, years_experience, specialties,
      //   accepted_insurance, session_types, languages, google_calendar_id,
      //   google_refresh_token, session_duration_minutes, availability_timezone,
      //   is_active, created_at, updated_at
      //
      // NOT in schema: title, is_accepting_patients, profile_image_url, phone
      const SELECT_FIELDS =
        "id, name, email, bio, photo_url, years_experience, specialties, " +
        "accepted_insurance, languages, session_types, is_active";

      let query = context.supabase
        .from("therapists")
        .select(SELECT_FIELDS)
        .eq("is_active", true) // ← was is_accepting_patients
        .overlaps("specialties", conditions);

      if (
        insurance !== "any" &&
        insurance !== "unknown" &&
        insurance !== "self-pay"
      ) {
        logger.db("Applying insurance filter", { insurance });
        query = query.contains("accepted_insurance", [insurance]);
      }

      if (sessionType !== "no-preference") {
        logger.db("Applying session type filter", { sessionType });
        query = query.contains("session_types", [sessionType]);
      }

      query = query.limit(limit);

      const { data: therapists, error } = await query;

      if (error) {
        logger.error("Therapist query failed", { error: error.message });
        throw new DatabaseError(
          `Failed to query therapists: ${error.message}`,
          error,
        );
      }

      logger.db(`Found ${therapists?.length ?? 0} matching therapists`);

      if (!therapists || therapists.length === 0) {
        // Fallback: drop insurance filter, keep specialty match
        logger.info(
          "No exact matches — attempting fallback without insurance filter",
        );

        const { data: fallback, error: fallbackError } = await context.supabase
          .from("therapists")
          .select(SELECT_FIELDS)
          .eq("is_active", true)
          .overlaps("specialties", conditions)
          .limit(limit);

        if (fallbackError) {
          logger.error("Fallback query also failed", {
            error: fallbackError.message,
          });
        }

        const fallbackResults = fallback ?? [];
        logger.db(`Fallback found ${fallbackResults.length} therapists`);

        return {
          success: true,
          data: {
            therapists: this.formatTherapists(fallbackResults),
            totalFound: fallbackResults.length,
            searchParams: { conditions, insurance, sessionType },
            note:
              fallbackResults.length > 0
                ? `No therapists found for insurance '${insurance}', but found ${fallbackResults.length} who specialize in your conditions. They may offer self-pay options.`
                : "No therapists found matching your criteria. Consider broadening your search.",
          },
        };
      }

      return {
        success: true,
        data: {
          therapists: this.formatTherapists(therapists),
          totalFound: therapists.length,
          searchParams: { conditions, insurance, sessionType },
          note: `Found ${therapists.length} therapist(s) matching your needs`,
        },
      };
    } catch (err) {
      logger.error("FindTherapistsTool failed", err);
      return {
        success: false,
        error: `Failed to find therapists: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  // deno-lint-ignore no-explicit-any
  private formatTherapists(therapists: any[]) {
    return therapists.map((t) => ({
      id: t.id,
      name: t.name,
      email: t.email,
      bio: t.bio
        ? t.bio.slice(0, 200) + (t.bio.length > 200 ? "..." : "")
        : null,
      photo_url: t.photo_url, // ← was profile_image_url
      years_experience: t.years_experience,
      specialties: t.specialties,
      accepted_insurance: t.accepted_insurance,
      languages: t.languages,
      session_types: t.session_types,
    }));
  }
}
