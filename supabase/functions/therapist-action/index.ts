// ============================================================
// supabase/functions/therapist-action/index.ts
// Token-based confirm/reject — no login required.
// Therapist clicks link in email → this function runs → redirects to result page.
// ============================================================

import { handleCors, corsJson } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logger.ts";
import { getSupabaseAdmin } from "../_shared/supabaseAdmin.ts";

const logger = createLogger("TherapistActionFunction");

const APP_URL = Deno.env.get("APP_URL") ?? "http://localhost:5173";

Deno.serve(async (req: Request) => {
  logger.info("therapist-action invoked", { method: req.method, url: req.url });

  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Only GET — links in emails are GET requests
  if (req.method !== "GET") {
    return corsJson({ success: false, error: "Only GET is accepted" }, 405);
  }

  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const action = url.searchParams.get("action"); // "confirm" | "reject"

  // ── Validate params ────────────────────────────────────────
  if (!token || !action) {
    return redirect(`${APP_URL}/therapist/action-result?status=invalid`);
  }

  if (action !== "confirm" && action !== "reject") {
    return redirect(`${APP_URL}/therapist/action-result?status=invalid`);
  }

  const supabase = getSupabaseAdmin();

  try {
    // ── Look up appointment by token ───────────────────────
    const { data: appointment, error: fetchError } = await supabase
      .from("appointments")
      .select(
        "id, status, confirmation_token_expires_at, therapist_id, patient_identifier, start_time",
      )
      .eq("confirmation_token", token)
      .single();

    if (fetchError || !appointment) {
      logger.warn("Token not found", { token: token.slice(0, 8) + "..." });
      return redirect(`${APP_URL}/therapist/action-result?status=not_found`);
    }

    // ── Check if already actioned ──────────────────────────
    if (appointment.status !== "pending") {
      logger.info("Appointment already actioned", {
        status: appointment.status,
      });
      return redirect(
        `${APP_URL}/therapist/action-result?status=already_actioned&action=${appointment.status}`,
      );
    }

    // ── Check token expiry ─────────────────────────────────
    const expiresAt = new Date(appointment.confirmation_token_expires_at);
    if (new Date() > expiresAt) {
      logger.warn("Confirmation token expired", {
        appointmentId: appointment.id,
      });
      // Mark as cancelled_by_therapist due to timeout (same as auto-cancel)
      await supabase
        .from("appointments")
        .update({
          status: "cancelled_by_therapist",
          therapist_action_at: new Date().toISOString(),
          therapist_rejection_reason: "Token expired — auto-cancelled",
        })
        .eq("id", appointment.id);
      return redirect(`${APP_URL}/therapist/action-result?status=expired`);
    }

    // ── Apply action ───────────────────────────────────────
    const newStatus =
      action === "confirm" ? "confirmed" : "cancelled_by_therapist";

    const { error: updateError } = await supabase
      .from("appointments")
      .update({
        status: newStatus,
        therapist_action_at: new Date().toISOString(),
        // Nullify token after use so link can't be reused
        confirmation_token: null,
        confirmation_token_expires_at: null,
      })
      .eq("id", appointment.id);

    if (updateError) {
      logger.error("Failed to update appointment status", {
        error: updateError.message,
      });
      return redirect(`${APP_URL}/therapist/action-result?status=error`);
    }

    // ── Send patient notification email ────────────────────
    // Fire-and-forget — don't block the redirect
    notifyPatientOfOutcome(
      supabase,
      appointment.id,
      appointment.patient_identifier,
      appointment.start_time,
      action,
    ).catch((e) =>
      logger.error("Patient notification failed (non-fatal)", { error: e }),
    );

    logger.info("Therapist action applied", {
      appointmentId: appointment.id,
      action,
      newStatus,
    });

    return redirect(
      `${APP_URL}/therapist/action-result?status=${action === "confirm" ? "confirmed" : "rejected"}`,
    );
  } catch (err) {
    logger.error("therapist-action unhandled error", { err });
    return redirect(`${APP_URL}/therapist/action-result?status=error`);
  }
});

// ── Redirect helper ────────────────────────────────────────
function redirect(url: string): Response {
  return new Response(null, {
    status: 302,
    headers: { Location: url },
  });
}

// ── Notify patient of outcome (fire-and-forget) ────────────
async function notifyPatientOfOutcome(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  appointmentId: string,
  patientIdentifier: string,
  startTime: string,
  action: string,
): Promise<void> {
  // In a real system, look up patient email from inquiry.
  // For now, we log — extend this when patient email is collected.
  logger.info("Patient notification queued", {
    appointmentId,
    patientIdentifier,
    action,
    startTime,
  });
  // TODO: When patient email collection is added, send outcome email here.
  // Pattern is identical to notifyTherapist.tool.ts (use Resend).
}
