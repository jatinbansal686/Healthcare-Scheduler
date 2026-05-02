// ============================================================
// services/TherapistService.ts
// Therapist auth + dashboard data + Google Calendar OAuth
// ============================================================

import type { Session, User } from "@supabase/supabase-js";
import type {
  ITherapistService,
  DashboardData,
  CalendarConnectResult,
} from "./ITherapistService";
import { supabase } from "../lib/supabaseClient";
import { logger } from "../lib/logger";
import { logAndNormalize } from "../lib/errorHandler";

const CONTEXT = "TherapistService";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;

// The redirect URI must match exactly what's registered in Google Cloud Console.
// Using window.location.origin makes it work in both dev and prod without env changes.
function getOAuthRedirectUri(): string {
  return `${window.location.origin}/auth/google/callback`;
}

// Google OAuth scopes needed: calendar read/write + basic profile
const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

export class TherapistService implements ITherapistService {
  async signIn(
    email: string,
    password: string,
  ): Promise<{ session: Session; user: User }> {
    logger.info(CONTEXT, "signIn called", { email });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      if (!data.session || !data.user)
        throw new Error("Authentication failed: no session returned");
      logger.info(CONTEXT, "signIn successful", { userId: data.user.id });
      return { session: data.session, user: data.user };
    } catch (err) {
      logAndNormalize(CONTEXT, err);
      throw err;
    }
  }

  async signOut(): Promise<void> {
    logger.info(CONTEXT, "signOut called");
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (err) {
      logAndNormalize(CONTEXT, err);
      throw err;
    }
  }

  async getSession(): Promise<Session | null> {
    logger.info(CONTEXT, "getSession called");
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      return data.session;
    } catch (err) {
      logAndNormalize(CONTEXT, err);
      throw err;
    }
  }

  onAuthStateChange(callback: (session: Session | null) => void): () => void {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      callback(session);
    });
    return () => subscription.unsubscribe();
  }

  async getDashboardData(
    session: Session,
    statusFilter = "all",
  ): Promise<DashboardData> {
    logger.info(CONTEXT, "getDashboardData called", { statusFilter });
    try {
      const params = new URLSearchParams({
        status: statusFilter,
        limit: "100",
      });
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/therapist-dashboard-data?${params}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: SUPABASE_ANON_KEY,
          },
        },
      );

      if (!response.ok) {
        const err = await response
          .json()
          .catch(() => ({ error: response.statusText }));
        throw new Error(
          err.error ?? `Dashboard fetch failed: ${response.status}`,
        );
      }

      const json = await response.json();
      if (!json.success)
        throw new Error(json.error ?? "Unknown error from dashboard API");

      logger.info(CONTEXT, "getDashboardData success", {
        appointmentCount: json.data.appointments.length,
      });
      return json.data as DashboardData;
    } catch (err) {
      logAndNormalize(CONTEXT, err);
      throw err;
    }
  }

  // ── Google OAuth ─────────────────────────────────────────

  /**
   * Builds the Google OAuth consent URL.
   * `state` carries the therapistId so the callback page knows who is connecting.
   * `access_type=offline` ensures we get a refresh_token.
   * `prompt=consent` forces the consent screen every time — needed to always get refresh_token.
   */
  buildGoogleOAuthUrl(therapistId: string): string {
    if (!GOOGLE_CLIENT_ID) {
      throw new Error(
        "VITE_GOOGLE_CLIENT_ID is not set. Add it to your .env file.",
      );
    }

    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: getOAuthRedirectUri(),
      response_type: "code",
      scope: GOOGLE_SCOPES,
      access_type: "offline",
      prompt: "consent", // always get refresh_token
      state: therapistId, // passed back on redirect so callback knows therapistId
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Called by GoogleOAuthCallbackPage after Google redirects back.
   * Sends the auth code to the oauth-callback edge function which:
   *   1. Exchanges code → refresh_token with Google
   *   2. Saves refresh_token + calendar_id to therapists table
   */
  async exchangeOAuthCode(
    session: Session,
    code: string,
    therapistId: string,
    redirectUri: string,
  ): Promise<CalendarConnectResult> {
    logger.info(CONTEXT, "exchangeOAuthCode called", { therapistId });
    try {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/oauth-callback`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: SUPABASE_ANON_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ code, therapistId, redirectUri }),
        },
      );

      const json = await response.json();

      if (!response.ok || !json.success) {
        const msg =
          json.error?.message ?? json.error ?? "OAuth exchange failed";
        logger.error(CONTEXT, "exchangeOAuthCode failed", { msg });
        return { success: false, error: msg };
      }

      logger.info(CONTEXT, "exchangeOAuthCode success", {
        calendarId: json.data.calendarId,
      });
      return { success: true, calendarId: json.data.calendarId };
    } catch (err) {
      const normalized = logAndNormalize(CONTEXT, err);
      return { success: false, error: normalized.message };
    }
  }

  /**
   * Clears the therapist's Google credentials from the DB.
   * Uses the therapist-dashboard-data PATCH endpoint pattern.
   */
  async disconnectGoogleCalendar(
    session: Session,
    therapistId: string,
  ): Promise<void> {
    logger.info(CONTEXT, "disconnectGoogleCalendar called", { therapistId });
    try {
      // Direct Supabase update — therapist can only update their own row via RLS
      const { error } = await supabase
        .from("therapists")
        .update({
          google_refresh_token: null,
          google_calendar_id: null,
        })
        .eq("id", therapistId);

      if (error) throw error;
      logger.info(CONTEXT, "Google Calendar disconnected", { therapistId });
    } catch (err) {
      logAndNormalize(CONTEXT, err);
      throw err;
    }
  }
}
