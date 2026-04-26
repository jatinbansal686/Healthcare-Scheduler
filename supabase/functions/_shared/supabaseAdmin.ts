// ============================================================
// _shared/supabaseAdmin.ts
// Service-role Supabase client — bypasses RLS for trusted server ops
// SOLID: SRP — one responsibility: provide authenticated DB access
// ============================================================

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger } from "./logger.ts";
import { DatabaseError } from "./error.ts";

const logger = createLogger("SupabaseAdmin");

let _client: SupabaseClient | null = null;

// Singleton — one client per edge function invocation lifecycle
export function getSupabaseAdmin(): SupabaseClient {
  if (_client) {
    logger.db("Returning cached Supabase admin client");
    return _client;
  }

  logger.db("Initializing Supabase admin client");

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl) {
    const err = new DatabaseError(
      "SUPABASE_URL environment variable is not set"
    );
    logger.error("Missing SUPABASE_URL", err);
    throw err;
  }

  if (!serviceRoleKey) {
    const err = new DatabaseError(
      "SUPABASE_SERVICE_ROLE_KEY environment variable is not set"
    );
    logger.error("Missing SUPABASE_SERVICE_ROLE_KEY", err);
    throw err;
  }

  _client = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  logger.db("Supabase admin client initialized successfully");
  return _client;
}

// Verify a user JWT and return the user — used by admin endpoints
export async function verifyUserToken(
  token: string
): Promise<{ id: string; email: string }> {
  logger.info("Verifying user JWT token");

  const supabase = getSupabaseAdmin();

  try {
    const { data, error } = await supabase.auth.getUser(token);

    if (error) {
      logger.error("JWT verification failed", { error: error.message });
      throw new DatabaseError(`Token verification failed: ${error.message}`, error);
    }

    if (!data.user) {
      logger.error("No user found for token");
      throw new DatabaseError("No user associated with provided token");
    }

    logger.info("JWT verified successfully", { userId: data.user.id });
    return { id: data.user.id, email: data.user.email ?? "" };
  } catch (err) {
    if (err instanceof DatabaseError) throw err;
    logger.error("Unexpected error during JWT verification", err);
    throw new DatabaseError("Unexpected error during token verification", err);
  }
}