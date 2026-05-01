// ============================================================
// services/TherapistService.ts
// Therapist auth + dashboard data — uses same Supabase client
// as AuthService, follows identical pattern for consistency
// ============================================================

import type { Session, User } from "@supabase/supabase-js";
import type { ITherapistService, DashboardData } from "./ITherapistService";
import { supabase } from "../lib/supabaseClient";
import { logger } from "../lib/logger";
import { logAndNormalize } from "../lib/errorHandler";

const CONTEXT = "TherapistService";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

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
}
