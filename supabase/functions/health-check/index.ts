// ============================================================
// health-check/index.ts
// Simple health check endpoint — useful for deployment verification
// and uptime monitoring
// ============================================================

import { handleCors, corsJson } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logger.ts";
import { getSupabaseAdmin } from "../_shared/supabaseAdmin.ts";

const logger = createLogger("HealthCheckFunction");

Deno.serve(async (req: Request) => {
  logger.info("health-check invoked");

  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const checks: Record<
    string,
    { ok: boolean; latencyMs?: number; error?: string }
  > = {};

  // ── Check Supabase DB connection ──────────────────────────
  try {
    const start = Date.now();
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("therapists").select("id").limit(1);
    checks.database = {
      ok: !error,
      latencyMs: Date.now() - start,
      error: error?.message,
    };
  } catch (err) {
    checks.database = {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  // ── Check Gemini API key is configured ────────────────────
  checks.geminiApiKey = {
    ok: !!Deno.env.get("GEMINI_API_KEY"),
  };

  // ── Check Google OAuth credentials ───────────────────────
  checks.googleOAuth = {
    ok: !!(
      Deno.env.get("GOOGLE_CLIENT_ID") && Deno.env.get("GOOGLE_CLIENT_SECRET")
    ),
  };

  const allOk = Object.values(checks).every((c) => c.ok);

  logger.info("Health check complete", { allOk, checks });

  return corsJson(
    {
      success: allOk,
      status: allOk ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      checks,
    },
    allOk ? 200 : 503,
  );
});
