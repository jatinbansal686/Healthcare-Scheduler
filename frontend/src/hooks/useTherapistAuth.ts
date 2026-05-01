// ============================================================
// hooks/useTherapistAuth.ts
// Therapist auth state — mirrors useAuth.ts pattern exactly
// ============================================================

import { useState, useEffect, useCallback } from "react";
import type { Session } from "@supabase/supabase-js";
import { TherapistService } from "../services/TherapistService";
import { logger } from "../lib/logger";
import { logAndNormalize } from "../lib/errorHandler";

const CONTEXT = "useTherapistAuth";

// Singleton — same Supabase session, no extra state
const therapistService = new TherapistService();

export interface UseTherapistAuthReturn {
  session: Session | null;
  isLoading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export function useTherapistAuth(): UseTherapistAuthReturn {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    logger.info(CONTEXT, "Fetching initial session");
    therapistService
      .getSession()
      .then((s) => {
        setSession(s);
        setIsLoading(false);
      })
      .catch((err) => {
        const normalized = logAndNormalize(CONTEXT, err);
        setError(normalized.message);
        setIsLoading(false);
      });

    const unsubscribe = therapistService.onAuthStateChange((newSession) => {
      logger.info(CONTEXT, "Auth state changed", { hasSession: !!newSession });
      setSession(newSession);
    });

    return () => unsubscribe();
  }, []);

  const signIn = useCallback(
    async (email: string, password: string): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        const { session: newSession } = await therapistService.signIn(
          email,
          password,
        );
        setSession(newSession);
      } catch (err) {
        const normalized = logAndNormalize(CONTEXT, err);
        setError(normalized.message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const signOut = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      await therapistService.signOut();
      setSession(null);
    } catch (err) {
      const normalized = logAndNormalize(CONTEXT, err);
      setError(normalized.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { session, isLoading, error, signIn, signOut };
}
