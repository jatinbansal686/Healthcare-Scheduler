// ============================================================
// AuthService.ts — Supabase auth implementation of IAuthService
// ============================================================

import type { Session, User } from '@supabase/supabase-js';
import type { IAuthService } from './ IAuthService';
import { supabase } from '../lib/supabaseClient';
import { logger } from '../lib/logger';
import { logAndNormalize } from '../lib/errorHandler';

const CONTEXT = 'AuthService';

export class AuthService implements IAuthService {
  async signIn(email: string, password: string): Promise<{ session: Session; user: User }> {
    logger.info(CONTEXT, 'signIn called', { email });

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        logger.error(CONTEXT, 'signIn failed', error);
        throw error;
      }

      if (!data.session || !data.user) {
        logger.error(CONTEXT, 'signIn returned null session/user');
        throw new Error('Authentication failed: no session returned');
      }

      logger.info(CONTEXT, 'signIn successful', { userId: data.user.id });
      return { session: data.session, user: data.user };
    } catch (err) {
      logAndNormalize(CONTEXT, err);
      throw err;
    }
  }

  async signOut(): Promise<void> {
    logger.info(CONTEXT, 'signOut called');

    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        logger.error(CONTEXT, 'signOut failed', error);
        throw error;
      }
      logger.info(CONTEXT, 'signOut successful');
    } catch (err) {
      logAndNormalize(CONTEXT, err);
      throw err;
    }
  }

  async getSession(): Promise<Session | null> {
    logger.info(CONTEXT, 'getSession called');

    try {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        logger.error(CONTEXT, 'getSession failed', error);
        throw error;
      }

      logger.info(CONTEXT, 'getSession result', { hasSession: !!data.session });
      return data.session;
    } catch (err) {
      logAndNormalize(CONTEXT, err);
      throw err;
    }
  }

  onAuthStateChange(callback: (session: Session | null) => void): () => void {
    logger.info(CONTEXT, 'Setting up onAuthStateChange listener');

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      logger.info(CONTEXT, 'Auth state changed', { event: _event, hasSession: !!session });
      callback(session);
    });

    return () => {
      logger.info(CONTEXT, 'Unsubscribing from onAuthStateChange');
      subscription.unsubscribe();
    };
  }
}