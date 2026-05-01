// // ============================================================
// // agent-chat/tools/extractStructuredInfo.tool.ts
// // Tool 1: Extract structured patient info from natural language
// // ============================================================

// import type { ITool, ToolContext, ToolResult } from "./ITool.ts";
// import type { FunctionDeclaration } from "../google/IGoogleClient.ts";
// import { createLogger } from "../../_shared/logger.ts";
// import { ValidationError } from "../../_shared/error.ts";

// const logger = createLogger("ExtractStructuredInfoTool");

// export class ExtractStructuredInfoTool implements ITool {
//   readonly name = "extractStructuredInfo";

//   readonly declaration: FunctionDeclaration = {
//     name: "extractStructuredInfo",
//     description:
//       "Extract structured patient information directly from the user's message. " +
//       "You MUST call this tool immediately when a user describes their mental health concerns, feelings, or need for therapy. " +
//       "Do NOT ask the user questions manually — this tool should be used to extract all available information from their message.",
//     parameters: {
//       type: "object",
//       properties: {
//         conditions: {
//           type: "array",
//           description:
//             "List of mental health conditions or concerns mentioned. " +
//             "Normalize to standard terms: e.g. 'feeling sad' → 'depression', " +
//             "'panic attacks' → 'anxiety'. " +
//             "Examples: ['anxiety', 'depression', 'trauma', 'grief', 'adhd', 'ocd', 'ptsd']",
//           items: { type: "string" },
//         },
//         insurance: {
//           type: "string",
//           description:
//             "Insurance provider mentioned by patient. Normalize to lowercase with no spaces. " +
//             "Examples: 'aetna', 'bluecross', 'bcbs', 'united', 'cigna', 'medicare', 'self-pay'. " +
//             "Use 'unknown' if not mentioned.",
//         },
//         schedule: {
//           type: "string",
//           description:
//             "Patient's scheduling preferences as a human-readable string. " +
//             "Examples: 'weekday evenings', 'Saturday mornings', 'any weekday', 'flexible'.",
//         },
//         patientName: {
//           type: "string",
//           description:
//             "Patient's name if they have mentioned it in the conversation. Empty string if unknown.",
//         },
//         urgency: {
//           type: "string",
//           description: "Urgency level based on conversation context.",
//           enum: ["low", "medium", "high", "crisis"],
//         },
//         sessionPreference: {
//           type: "string",
//           description: "Preferred session type.",
//           enum: ["in-person", "telehealth", "no-preference"],
//         },
//       },
//       required: ["conditions"],
//       // Only `conditions` is required — all other fields are optional.
//       // The execute() method below applies safe defaults for missing fields
//       // so Gemini can call this tool with minimal info on the first turn.
//     },
//   };

//   async execute(
//     args: Record<string, unknown>,
//     _context: ToolContext,
//   ): Promise<ToolResult> {
//     logger.tool("ExtractStructuredInfoTool.execute called", { args });

//     try {
//       // ── FIX: Only validate what is actually marked required above.
//       //         Previously, insurance/schedule were validated as required strings
//       //         even though they were not in the `required` array, causing the
//       //         tool to throw when Gemini called it with only `conditions`.
//       if (!Array.isArray(args.conditions) || args.conditions.length === 0) {
//         throw new ValidationError("'conditions' must be a non-empty array");
//       }

//       const extracted = {
//         conditions: args.conditions as string[],
//         // Safe defaults for all optional fields
//         insurance:
//           typeof args.insurance === "string"
//             ? args.insurance.toLowerCase().trim()
//             : "unknown",
//         schedule:
//           typeof args.schedule === "string" ? args.schedule : "flexible",
//         patientName:
//           typeof args.patientName === "string" ? args.patientName : "",
//         urgency: typeof args.urgency === "string" ? args.urgency : "medium",
//         sessionPreference:
//           typeof args.sessionPreference === "string"
//             ? args.sessionPreference
//             : "no-preference",
//       };

//       logger.tool("Structured info extracted successfully", extracted);

//       if (extracted.urgency === "crisis") {
//         logger.warn(
//           "CRISIS URGENCY DETECTED — patient may need immediate help",
//           { patientName: extracted.patientName },
//         );
//       }

//       return {
//         success: true,
//         data: {
//           ...extracted,
//           extractedAt: new Date().toISOString(),
//           message:
//             extracted.urgency === "crisis"
//               ? "Crisis level urgency detected. Prioritize immediate response."
//               : `Successfully extracted: ${extracted.conditions.length} condition(s), insurance: ${extracted.insurance}`,
//         },
//       };
//     } catch (err) {
//       logger.error("ExtractStructuredInfoTool failed", err);
//       return {
//         success: false,
//         error: `Failed to extract structured info: ${err instanceof Error ? err.message : String(err)}`,
//       };
//     }
//   }
// }

// ============================================================
// agent-chat/tools/extractStructuredInfo.tool.ts
// Tool 1: Extract structured patient info from natural language
// ============================================================

import type { ITool, ToolContext, ToolResult } from "./ITool.ts";
import type { FunctionDeclaration } from "../google/IGoogleClient.ts";
import { createLogger } from "../../_shared/logger.ts";
import { ValidationError } from "../../_shared/error.ts";

const logger = createLogger("ExtractStructuredInfoTool");

export class ExtractStructuredInfoTool implements ITool {
  readonly name = "extractStructuredInfo";

  readonly declaration: FunctionDeclaration = {
    name: "extractStructuredInfo",
    description:
      "Extract structured patient information directly from the user's message. " +
      "You MUST call this tool immediately when a user describes their mental health concerns, feelings, or need for therapy. " +
      "Do NOT ask the user questions manually — this tool should be used to extract all available information from their message.",
    parameters: {
      type: "object",
      properties: {
        conditions: {
          type: "array",
          description:
            "List of mental health conditions or concerns mentioned. " +
            "Normalize to standard terms: e.g. 'feeling sad' → 'depression', " +
            "'panic attacks' → 'anxiety'. " +
            "Examples: ['anxiety', 'depression', 'trauma', 'grief', 'adhd', 'ocd', 'ptsd']",
          items: { type: "string" },
        },
        insurance: {
          type: "string",
          description:
            "Insurance provider mentioned by patient. Normalize to lowercase with no spaces. " +
            "Examples: 'aetna', 'bluecross', 'bcbs', 'united', 'cigna', 'medicare', 'self-pay'. " +
            "Use 'unknown' if not mentioned.",
        },
        schedule: {
          type: "string",
          description:
            "Patient's scheduling preferences as a human-readable string. " +
            "Examples: 'weekday evenings', 'Saturday mornings', 'any weekday', 'flexible'.",
        },
        patientName: {
          type: "string",
          description:
            "Patient's name if they have mentioned it in the conversation. Empty string if unknown.",
        },
        patientEmail: {
          type: "string",
          description:
            "Patient's email address if they have provided it. Empty string if not yet given.",
        },
        urgency: {
          type: "string",
          description: "Urgency level based on conversation context.",
          enum: ["low", "medium", "high", "crisis"],
        },
        sessionPreference: {
          type: "string",
          description: "Preferred session type.",
          enum: ["in-person", "telehealth", "no-preference"],
        },
      },
      required: ["conditions"],
      // Only `conditions` is required — all other fields are optional.
      // The execute() method below applies safe defaults for missing fields
      // so Gemini can call this tool with minimal info on the first turn.
    },
  };

  async execute(
    args: Record<string, unknown>,
    _context: ToolContext,
  ): Promise<ToolResult> {
    logger.tool("ExtractStructuredInfoTool.execute called", { args });

    try {
      // ── FIX: Only validate what is actually marked required above.
      //         Previously, insurance/schedule were validated as required strings
      //         even though they were not in the `required` array, causing the
      //         tool to throw when Gemini called it with only `conditions`.
      if (!Array.isArray(args.conditions) || args.conditions.length === 0) {
        throw new ValidationError("'conditions' must be a non-empty array");
      }

      const extracted = {
        conditions: args.conditions as string[],
        // Safe defaults for all optional fields
        insurance:
          typeof args.insurance === "string"
            ? args.insurance.toLowerCase().trim()
            : "unknown",
        schedule:
          typeof args.schedule === "string" ? args.schedule : "flexible",
        patientName:
          typeof args.patientName === "string" ? args.patientName : "",
        patientEmail:
          typeof args.patientEmail === "string" ? args.patientEmail : "",
        urgency: typeof args.urgency === "string" ? args.urgency : "medium",
        sessionPreference:
          typeof args.sessionPreference === "string"
            ? args.sessionPreference
            : "no-preference",
      };

      logger.tool("Structured info extracted successfully", extracted);

      if (extracted.urgency === "crisis") {
        logger.warn(
          "CRISIS URGENCY DETECTED — patient may need immediate help",
          { patientName: extracted.patientName },
        );
      }

      return {
        success: true,
        data: {
          ...extracted,
          extractedAt: new Date().toISOString(),
          message:
            extracted.urgency === "crisis"
              ? "Crisis level urgency detected. Prioritize immediate response."
              : `Successfully extracted: ${extracted.conditions.length} condition(s), insurance: ${extracted.insurance}`,
        },
      };
    } catch (err) {
      logger.error("ExtractStructuredInfoTool failed", err);
      return {
        success: false,
        error: `Failed to extract structured info: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }
}
