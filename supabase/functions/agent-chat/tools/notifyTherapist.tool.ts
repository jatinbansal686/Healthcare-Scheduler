// ============================================================
// agent-chat/tools/notifyTherapist.tool.ts
// Tool 9: Send email notification to therapist after pending booking
// Contains confirm/reject links (token-based, no login required)
// ============================================================

import type { ITool, ToolContext, ToolResult } from "./ITool.ts";
import type { FunctionDeclaration } from "../google/IGoogleClient.ts";
import { createLogger } from "../../_shared/logger.ts";
import { ValidationError } from "../../_shared/error.ts";

const logger = createLogger("NotifyTherapistTool");

export class NotifyTherapistTool implements ITool {
  readonly name = "notifyTherapist";

  readonly declaration: FunctionDeclaration = {
    name: "notifyTherapist",
    description:
      "Send an email notification to the therapist about a new pending appointment. " +
      "The email contains a confirm link and a reject link. " +
      "ALWAYS call this immediately after bookAppointment succeeds. " +
      "Pass the confirmationToken and therapistEmail from bookAppointment's result.",
    parameters: {
      type: "object",
      properties: {
        appointmentId: {
          type: "string",
          description: "UUID of the pending appointment",
        },
        confirmationToken: {
          type: "string",
          description: "Token from bookAppointment result",
        },
        therapistEmail: {
          type: "string",
          description: "Therapist email from bookAppointment result",
        },
        therapistName: { type: "string", description: "Therapist's full name" },
        patientName: { type: "string", description: "Patient's name" },
        startTime: {
          type: "string",
          description: "Appointment start time (ISO 8601)",
        },
        endTime: {
          type: "string",
          description: "Appointment end time (ISO 8601)",
        },
        appointmentType: {
          type: "string",
          description: "Type of therapy session",
        },
        notes: { type: "string", description: "Any special notes (optional)" },
      },
      required: [
        "appointmentId",
        "confirmationToken",
        "therapistEmail",
        "therapistName",
        "patientName",
        "startTime",
        "endTime",
        "appointmentType",
      ],
    },
  };

  async execute(
    args: Record<string, unknown>,
    context: ToolContext,
  ): Promise<ToolResult> {
    logger.tool("NotifyTherapistTool.execute called", {
      appointmentId: args.appointmentId,
      therapistEmail: args.therapistEmail,
    });

    try {
      // ── Validate ───────────────────────────────────────────
      const required = [
        "appointmentId",
        "confirmationToken",
        "therapistEmail",
        "therapistName",
        "patientName",
        "startTime",
        "endTime",
      ];
      for (const field of required) {
        if (!args[field]) throw new ValidationError(`'${field}' is required`);
      }

      const startDate = new Date(args.startTime as string);
      const endDate = new Date(args.endTime as string);

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

      // ── Build action URLs ──────────────────────────────────
      const baseUrl = Deno.env.get("SUPABASE_URL")!;
      const appUrl = Deno.env.get("APP_URL") ?? "http://localhost:5173";
      const token = args.confirmationToken as string;

      // These hit the therapist-action edge function (no auth required)
      const confirmUrl = `${baseUrl}/functions/v1/therapist-action?token=${token}&action=confirm`;
      const rejectUrl = `${baseUrl}/functions/v1/therapist-action?token=${token}&action=reject`;

      // ── Build email HTML ───────────────────────────────────
      const emailHtml = buildEmailHtml({
        therapistName: args.therapistName as string,
        patientName: args.patientName as string,
        formattedDate,
        durationMinutes,
        appointmentType: args.appointmentType as string,
        notes: args.notes as string | undefined,
        confirmUrl,
        rejectUrl,
        appUrl,
      });

      // ── Send via Resend ────────────────────────────────────
      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (!resendKey) {
        logger.warn("RESEND_API_KEY not set — skipping email (dev mode)");
        logger.info("Would have sent email to", {
          to: args.therapistEmail,
          confirmUrl,
          rejectUrl,
        });
        return {
          success: true,
          data: {
            emailSent: false,
            devMode: true,
            confirmUrl,
            rejectUrl,
            message:
              "Email skipped (RESEND_API_KEY not configured). Appointment is pending.",
          },
        };
      }

      const fromEmail =
        Deno.env.get("FROM_EMAIL") ?? "noreply@healthscheduler.app";

      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `HealthScheduler <${fromEmail}>`,
          to: [args.therapistEmail as string],
          subject: `New Appointment Request — ${args.patientName} on ${formattedDate}`,
          html: emailHtml,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        logger.error("Resend API error", {
          status: response.status,
          body: errText,
        });
        // Non-fatal — appointment is already in DB as pending
        return {
          success: true,
          data: {
            emailSent: false,
            error: `Email delivery failed: ${response.status}`,
            message:
              "Appointment saved as pending. Email notification failed — therapist will see it on dashboard.",
          },
        };
      }

      const resendData = await response.json();
      logger.tool("Therapist notification email sent", {
        emailId: resendData.id,
      });

      return {
        success: true,
        data: {
          emailSent: true,
          emailId: resendData.id,
          sentTo: args.therapistEmail,
          message: `Notification email sent to ${args.therapistName}. They have 24 hours to confirm.`,
        },
      };
    } catch (err) {
      logger.error("NotifyTherapistTool failed", { error: err });
      // Non-fatal — the appointment is already saved as pending
      return {
        success: true, // Still true — appointment exists, just email failed
        data: {
          emailSent: false,
          error: err instanceof Error ? err.message : String(err),
          message:
            "Appointment saved as pending. Email notification failed — therapist will see it on dashboard.",
        },
      };
    }
  }
}

// ── Email template ─────────────────────────────────────────
interface EmailTemplateArgs {
  therapistName: string;
  patientName: string;
  formattedDate: string;
  durationMinutes: number;
  appointmentType: string;
  notes?: string;
  confirmUrl: string;
  rejectUrl: string;
  appUrl: string;
}

function buildEmailHtml(args: EmailTemplateArgs): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Appointment Request</title>
</head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#0d9488,#0f766e);padding:32px 40px;">
            <p style="margin:0;color:#99f6e4;font-size:12px;font-weight:600;letter-spacing:2px;text-transform:uppercase;">HealthScheduler</p>
            <h1 style="margin:8px 0 0;color:#ffffff;font-size:24px;font-weight:700;">New Appointment Request</h1>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <p style="margin:0 0 24px;color:#374151;font-size:16px;">Hi <strong>${args.therapistName}</strong>,</p>
            <p style="margin:0 0 28px;color:#6b7280;font-size:15px;line-height:1.6;">
              A patient has requested an appointment with you. Please confirm or decline within <strong>24 hours</strong> — the request will be auto-cancelled if no action is taken.
            </p>
            <!-- Appointment Details Box -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:32px;">
              <tr><td style="padding:24px;">
                <p style="margin:0 0 16px;color:#0f766e;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Appointment Details</p>
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:6px 0;color:#6b7280;font-size:14px;width:120px;">Patient</td>
                    <td style="padding:6px 0;color:#111827;font-size:14px;font-weight:600;">${args.patientName}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;color:#6b7280;font-size:14px;">Date & Time</td>
                    <td style="padding:6px 0;color:#111827;font-size:14px;font-weight:600;">${args.formattedDate}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;color:#6b7280;font-size:14px;">Duration</td>
                    <td style="padding:6px 0;color:#111827;font-size:14px;font-weight:600;">${args.durationMinutes} minutes</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;color:#6b7280;font-size:14px;">Type</td>
                    <td style="padding:6px 0;color:#111827;font-size:14px;font-weight:600;text-transform:capitalize;">${args.appointmentType}</td>
                  </tr>
                  ${
                    args.notes
                      ? `
                  <tr>
                    <td style="padding:6px 0;color:#6b7280;font-size:14px;">Notes</td>
                    <td style="padding:6px 0;color:#111827;font-size:14px;">${args.notes}</td>
                  </tr>`
                      : ""
                  }
                </table>
              </td></tr>
            </table>
            <!-- Action Buttons -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td style="padding-right:8px;">
                  <a href="${args.confirmUrl}" style="display:block;background:#0d9488;color:#ffffff;text-align:center;padding:14px 24px;border-radius:8px;font-size:15px;font-weight:700;text-decoration:none;">
                    ✓ Confirm Appointment
                  </a>
                </td>
                <td style="padding-left:8px;">
                  <a href="${args.rejectUrl}" style="display:block;background:#ffffff;color:#dc2626;text-align:center;padding:14px 24px;border-radius:8px;font-size:15px;font-weight:700;text-decoration:none;border:2px solid #dc2626;">
                    ✕ Decline
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:0;color:#9ca3af;font-size:13px;line-height:1.5;">
              Or manage all appointments on your <a href="${args.appUrl}/therapist/dashboard" style="color:#0d9488;">dashboard →</a>
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">
              This is an automated message from HealthScheduler. Do not reply to this email.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
