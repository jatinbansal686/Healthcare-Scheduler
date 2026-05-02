// ============================================================
// oauth-callback/index.ts
// Handles the Google OAuth redirect for connecting therapist calendars
// Exchanges auth code for refresh token and stores it securely in DB
// ============================================================

import { handleCors, corsJson } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logger.ts";
import { normalizeError } from "../_shared/error.ts";
import { getSupabaseAdmin, verifyUserToken } from "../_shared/supabaseAdmin.ts";
import { CalendarError, AuthError, ValidationError } from "../_shared/error.ts";

const logger = createLogger("OAuthCallbackFunction");

const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

Deno.serve(async (req: Request) => {
  logger.info("oauth-callback function invoked", { method: req.method });

  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return corsJson(
      req,
      {
        success: false,
        error: { code: "METHOD_NOT_ALLOWED", message: "Only POST accepted" },
      },
      405,
    );
  }

  try {
    // ── Verify the request comes from an authenticated therapist ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      throw new AuthError("Authorization header required");
    }
    const token = authHeader.slice(7);
    const user = await verifyUserToken(token);
    logger.info("Therapist authenticated for OAuth callback", {
      userId: user.id,
    });

    // ── Parse request body ────────────────────────────────────
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new ValidationError("Request body must be valid JSON");
    }

    const b = body as Record<string, unknown>;

    if (!b.code || typeof b.code !== "string") {
      throw new ValidationError(
        "'code' is required (the authorization code from Google)",
      );
    }
    if (!b.therapistId || typeof b.therapistId !== "string") {
      throw new ValidationError("'therapistId' is required");
    }
    if (!b.redirectUri || typeof b.redirectUri !== "string") {
      throw new ValidationError("'redirectUri' is required");
    }

    const { code, therapistId, redirectUri } = b as {
      code: string;
      therapistId: string;
      redirectUri: string;
    };

    logger.info("Processing OAuth callback", { therapistId });

    // ── Exchange authorization code for tokens ────────────────
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

    if (!clientId || !clientSecret) {
      throw new CalendarError("Google OAuth credentials not configured");
    }

    const tokenBody = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    });

    const tokenResponse = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenBody.toString(),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      logger.error("Google token exchange failed", {
        status: tokenResponse.status,
        body: errorText,
      });
      throw new CalendarError(
        `Google token exchange failed (${tokenResponse.status}): ${errorText}`,
      );
    }

    const tokenData = await tokenResponse.json();

    if (!tokenData.refresh_token) {
      throw new CalendarError(
        "Google did not return a refresh token. Please revoke access at myaccount.google.com/permissions and try again.",
      );
    }

    // ── Get the calendar ID (primary = therapist's email) ─────
    const calendarResponse = await fetch(
      "https://www.googleapis.com/calendar/v3/users/me/calendarList/primary",
      { headers: { Authorization: `Bearer ${tokenData.access_token}` } },
    );

    let calendarId = "primary";
    if (calendarResponse.ok) {
      const calendarData = await calendarResponse.json();
      calendarId = calendarData.id ?? "primary";
    } else {
      logger.warn("Could not fetch calendar ID — using 'primary' as fallback");
    }

    // ── Store credentials in DB ───────────────────────────────
    const supabase = getSupabaseAdmin();

    const { error: updateError } = await supabase
      .from("therapists")
      .update({
        google_refresh_token: tokenData.refresh_token,
        google_calendar_id: calendarId,
      })
      .eq("id", therapistId);

    if (updateError) {
      throw new CalendarError(
        `Failed to save calendar credentials: ${updateError.message}`,
      );
    }

    logger.info("OAuth flow completed successfully", {
      therapistId,
      calendarId,
    });

    return corsJson(req, {
      success: true,
      data: {
        message: "Google Calendar connected successfully",
        therapistId,
        calendarId,
      },
    });
  } catch (err) {
    logger.error("OAuth callback failed", err);
    const normalized = normalizeError(err);
    return corsJson(
      req,
      {
        success: false,
        error: { code: normalized.code, message: normalized.message },
      },
      normalized.statusCode,
    );
  }
});
