// ============================================================
// supabase/functions/therapist-action/index.ts
// Token-based confirm/reject — no login required.
// Therapist clicks link in email → this function runs → redirects to result page.
// On confirm: also updates the Google Calendar event from "tentative" → "confirmed".
// On reject:  also deletes the Google Calendar event.
// ============================================================

import { handleCors, corsJson } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logger.ts";
import { getSupabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { GoogleCalendarClient } from "../agent-chat/google/GoogleCalendarClient.ts";
import { TokenRefresher } from "../agent-chat/google/tokenRefresher.ts";

const logger = createLogger("TherapistActionFunction");

const APP_URL = Deno.env.get("APP_URL") ?? "http://localhost:5173";

// Instantiate calendar helpers once — they are stateless / env-driven
const calendarClient = new GoogleCalendarClient();
// TokenRefresher reads GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET from env.
// If those vars are absent it throws at construction time — caught below.
let tokenRefresher: TokenRefresher | null = null;
try {
  tokenRefresher = new TokenRefresher();
} catch (e) {
  logger.warn("TokenRefresher unavailable — calendar updates will be skipped", {
    reason: (e as Error).message,
  });
}

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
        "id, status, confirmation_token_expires_at, therapist_id, patient_identifier, start_time, google_calendar_event_id",
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
      await supabase
        .from("appointments")
        .update({
          status: "cancelled_by_therapist",
          therapist_action_at: new Date().toISOString(),
          therapist_rejection_reason: "Token expired — auto-cancelled",
        })
        .eq("id", appointment.id);

      // Delete the tentative calendar event on expiry too (fire-and-forget)
      if (appointment.google_calendar_event_id) {
        deleteCalendarEventForTherapist(
          supabase,
          appointment.therapist_id,
          appointment.google_calendar_event_id,
        ).catch((e) =>
          logger.error("Calendar delete on expiry failed (non-fatal)", { e }),
        );
      }

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

    // ── Sync Google Calendar event (fire-and-forget) ───────
    if (appointment.google_calendar_event_id) {
      if (action === "confirm") {
        confirmCalendarEvent(
          supabase,
          appointment.therapist_id,
          appointment.google_calendar_event_id,
        ).catch((e) =>
          logger.error("Calendar confirm update failed (non-fatal)", { e }),
        );
      } else {
        deleteCalendarEventForTherapist(
          supabase,
          appointment.therapist_id,
          appointment.google_calendar_event_id,
        ).catch((e) =>
          logger.error("Calendar delete on reject failed (non-fatal)", { e }),
        );
      }
    }

    // ── Send patient notification email ────────────────────
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

// ── Fetch therapist calendar credentials ──────────────────
async function getTherapistCalendarCreds(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  therapistId: string,
): Promise<{ calendarId: string; refreshToken: string } | null> {
  const { data, error } = await supabase
    .from("therapists")
    .select("google_calendar_id, google_refresh_token")
    .eq("id", therapistId)
    .single();

  if (error || !data?.google_calendar_id || !data?.google_refresh_token) {
    logger.warn(
      "Therapist has no calendar credentials — skipping calendar op",
      {
        therapistId,
      },
    );
    return null;
  }

  return {
    calendarId: data.google_calendar_id,
    refreshToken: data.google_refresh_token,
  };
}

// ── Update calendar event to "confirmed" ──────────────────
async function confirmCalendarEvent(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  therapistId: string,
  calendarEventId: string,
): Promise<void> {
  if (!tokenRefresher) {
    logger.warn("TokenRefresher not available — skipping calendar confirm");
    return;
  }

  const creds = await getTherapistCalendarCreds(supabase, therapistId);
  if (!creds) return;

  const accessToken = await tokenRefresher.getAccessToken(creds.refreshToken);

  await calendarClient.updateEvent(
    creds.calendarId,
    accessToken,
    calendarEventId,
    {
      summary: (
        await getEventSummary(creds, calendarEventId, accessToken)
      ).replace("[PENDING] ", ""),
      status: "confirmed",
    },
  );

  logger.calendar("Calendar event confirmed", { calendarEventId });
}

// ── Helper: get current event summary to strip [PENDING] prefix ──
async function getEventSummary(
  creds: { calendarId: string },
  calendarEventId: string,
  accessToken: string,
): Promise<string> {
  try {
    const events = await calendarClient.listEvents(
      creds.calendarId,
      accessToken,
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days back
      new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year ahead
    );
    const event = events.find((e) => e.id === calendarEventId);
    return event?.summary ?? "Therapy Session";
  } catch {
    return "Therapy Session";
  }
}

// ── Delete calendar event (on reject/cancel/expiry) ───────
async function deleteCalendarEventForTherapist(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  therapistId: string,
  calendarEventId: string,
): Promise<void> {
  if (!tokenRefresher) {
    logger.warn("TokenRefresher not available — skipping calendar delete");
    return;
  }

  const creds = await getTherapistCalendarCreds(supabase, therapistId);
  if (!creds) return;

  const accessToken = await tokenRefresher.getAccessToken(creds.refreshToken);
  await calendarClient.deleteEvent(
    creds.calendarId,
    accessToken,
    calendarEventId,
  );
  logger.calendar("Calendar event deleted", { calendarEventId });
}

// ── Notify patient of outcome (fire-and-forget) ────────────
async function notifyPatientOfOutcome(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  appointmentId: string,
  patientIdentifier: string,
  startTime: string,
  action: string,
): Promise<void> {
  logger.info("Patient notification queued", {
    appointmentId,
    patientIdentifier,
    action,
    startTime,
  });
  // TODO: When patient email collection is added, send outcome email here.
}
