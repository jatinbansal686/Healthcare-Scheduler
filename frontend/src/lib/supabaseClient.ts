// ============================================================
// supabaseClient.ts — Supabase client singleton
// Uses environment variables — never hardcode keys
// ============================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from './logger';

const CONTEXT = 'SupabaseClient';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// ---- Validation at startup — fail fast ----
if (!supabaseUrl) {
  logger.error(CONTEXT, 'VITE_SUPABASE_URL is missing from environment variables');
  throw new Error('VITE_SUPABASE_URL is not defined. Check your .env file.');
}

if (!supabaseAnonKey) {
  logger.error(CONTEXT, 'VITE_SUPABASE_ANON_KEY is missing from environment variables');
  throw new Error('VITE_SUPABASE_ANON_KEY is not defined. Check your .env file.');
}

logger.info(CONTEXT, 'Initializing Supabase client', { url: supabaseUrl });

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

logger.info(CONTEXT, 'Supabase client initialized successfully');