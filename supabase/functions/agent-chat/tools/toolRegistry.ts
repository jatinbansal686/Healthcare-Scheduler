// ============================================================
// agent-chat/tools/toolRegistry.ts
// Central registry of all available agent tools
// SOLID: OCP — to add a new tool: implement ITool, import here, add to array
//              AgentOrchestrator.ts is NEVER modified when tools are added
// ============================================================

import type { ITool } from "./ITool.ts";
import { ExtractStructuredInfoTool } from "./extractStructuredInfo.tool.ts";
import { SaveInquiryTool } from "./saveInquiry.tool.ts";
import { FindTherapistsTool } from "./findTherapists.tool.ts";
import { CheckAvailabilityTool } from "./checkAvailability.tool.ts";
import { BookAppointmentTool } from "./bookAppointment.tool.ts";
import { GetTherapistProfileTool } from "./getTherapistProfile.tool.ts";
import { UpdateAppointmentStatusTool } from "./updateAppointmentStatus.tool.ts";
import { SendConfirmationTool } from "./sendConfirmation.tool.ts";
// OCP: New tool added — no other file in this registry needed changing
import { RespondToUserTool } from "./respondToUser.tool.ts";
// OCP: Therapist notification tool — sends email after pending booking
import { NotifyTherapistTool } from "./notifyTherapist.tool.ts";
import { createLogger } from "../../_shared/logger.ts";

const logger = createLogger("ToolRegistry");

export class ToolRegistry {
  private readonly tools: Map<string, ITool> = new Map();

  constructor() {
    logger.info("Initializing ToolRegistry");
    this.registerDefaults();
    logger.info(`ToolRegistry ready with ${this.tools.size} tools`, {
      toolNames: this.getToolNames(),
    });
  }

  private registerDefaults(): void {
    logger.info("Registering default tools");

    this.register(new ExtractStructuredInfoTool());
    this.register(new SaveInquiryTool());
    this.register(new FindTherapistsTool());
    this.register(new CheckAvailabilityTool());
    this.register(new BookAppointmentTool());
    this.register(new NotifyTherapistTool()); // ← always called after bookAppointment
    this.register(new GetTherapistProfileTool());
    this.register(new UpdateAppointmentStatusTool());
    this.register(new SendConfirmationTool());
    // Structured response tool — must be last so AI knows to use it
    this.register(new RespondToUserTool());

    logger.info("Default tools registered");
  }

  register(tool: ITool): void {
    if (this.tools.has(tool.name)) {
      logger.warn(`Tool '${tool.name}' is already registered — overwriting`);
    }
    logger.info(`Registering tool: ${tool.name}`);
    this.tools.set(tool.name, tool);
  }

  getAll(): ITool[] {
    return Array.from(this.tools.values());
  }

  getByName(name: string): ITool | undefined {
    return this.tools.get(name);
  }

  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }
}
