// ============================================================
// IAuthService.ts — Auth service interface (DIP)
// ============================================================

import type { Session, User } from '@supabase/supabase-js';

export interface IAuthService {
  signIn(email: string, password: string): Promise<{ session: Session; user: User }>;
  signOut(): Promise<void>;
  getSession(): Promise<Session | null>;
  onAuthStateChange(callback: (session: Session | null) => void): () => void;
}