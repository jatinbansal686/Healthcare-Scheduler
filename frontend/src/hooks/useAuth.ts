// ============================================================
// useAuth.ts — Manages Supabase session + auth state
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { AuthService } from '../services/AuthService';
import { logger } from '../lib/logger';
import { logAndNormalize } from '../lib/errorHandler';

const CONTEXT = 'useAuth';

const authService = new AuthService();

export interface UseAuthReturn {
  session: Session | null;
  isLoading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  logger.debug(CONTEXT, 'useAuth hook initialized');

  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    logger.info(CONTEXT, 'Fetching initial session');

    authService.getSession().then((s) => {
      logger.info(CONTEXT, 'Initial session loaded', { hasSession: !!s });
      setSession(s);
      setIsLoading(false);
    }).catch((err) => {
      const normalized = logAndNormalize(CONTEXT, err);
      setError(normalized.message);
      setIsLoading(false);
    });

    const unsubscribe = authService.onAuthStateChange((newSession) => {
      logger.info(CONTEXT, 'Auth state change received', { hasSession: !!newSession });
      setSession(newSession);
    });

    return () => {
      logger.info(CONTEXT, 'Cleaning up auth listener');
      unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<void> => {
    logger.info(CONTEXT, 'signIn called', { email });
    setIsLoading(true);
    setError(null);

    try {
      const { session: newSession } = await authService.signIn(email, password);
      logger.info(CONTEXT, 'signIn successful');
      setSession(newSession);
    } catch (err) {
      const normalized = logAndNormalize(CONTEXT, err);
      setError(normalized.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    logger.info(CONTEXT, 'signOut called');
    setIsLoading(true);
    setError(null);

    try {
      await authService.signOut();
      logger.info(CONTEXT, 'signOut successful');
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