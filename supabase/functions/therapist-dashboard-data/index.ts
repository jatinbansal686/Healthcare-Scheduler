// ============================================================
// supabase/functions/therapist-dashboard-data/index.ts
// GET  — returns therapist's appointments + stats
// PATCH — confirms or rejects a pending appointment (authenticated)
// ============================================================

import { handleCors, corsJson } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logger.ts";
import { getSupabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const logger = createLogger("TherapistDashboardData");

const VALID_THERAPIST_STATUSES = [
  "confirmed",
  "cancelled_by_therapist",
] as const;

Deno.serve(async (req: Request) => {
  logger.info("therapist-dashboard-data invoked", { method: req.method });

  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "GET" && req.method !== "PATCH") {
    return corsJson(
      req,
      { success: false, error: "Only GET and PATCH are accepted" },
      405,
    );
  }

  // ── Authenticate ───────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return corsJson(
      req,
      { success: false, error: "Missing or invalid Authorization header" },
      401,
    );
  }

  const jwt = authHeader.replace("Bearer ", "");

  try {
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: `Bearer ${jwt}` } } },
    );

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();
    if (authError || !user) {
      return corsJson(
        req,
        { success: false, error: "Invalid or expired token" },
        401,
      );
    }

    const supabase = getSupabaseAdmin();

    // ── Look up therapist by auth_user_id ──────────────────
    const { data: therapist, error: therapistError } = await supabase
      .from("therapists")
      .select(
        "id, name, email, specialties, session_duration_minutes, availability_timezone",
      )
      .eq("auth_user_id", user.id)
      .single();

    if (therapistError || !therapist) {
      logger.warn("No therapist record for auth user", {
        userId: user.id,
        error: therapistError?.message,
      });
      return corsJson(
        req,
        { success: false, error: "Therapist profile not found" },
        404,
      );
    }

    // ── PATCH: inline confirm/reject from dashboard ────────
    if (req.method === "PATCH") {
      let body: { appointmentId?: string; status?: string };
      try {
        body = await req.json();
      } catch {
        return corsJson(
          req,
          { success: false, error: "Invalid JSON body" },
          400,
        );
      }

      const { appointmentId, status } = body;

      if (!appointmentId || typeof appointmentId !== "string") {
        return corsJson(
          req,
          { success: false, error: "'appointmentId' is required" },
          400,
        );
      }
      if (
        !status ||
        !VALID_THERAPIST_STATUSES.includes(
          status as (typeof VALID_THERAPIST_STATUSES)[number],
        )
      ) {
        return corsJson(
          req,
          {
            success: false,
            error: `'status' must be one of: ${VALID_THERAPIST_STATUSES.join(", ")}`,
          },
          400,
        );
      }

      // Verify ownership + pending state
      const { data: existing, error: fetchErr } = await supabase
        .from("appointments")
        .select("id, status, therapist_id")
        .eq("id", appointmentId)
        .eq("therapist_id", therapist.id)
        .single();

      if (fetchErr || !existing) {
        return corsJson(
          req,
          { success: false, error: "Appointment not found or access denied" },
          404,
        );
      }
      if (existing.status !== "pending") {
        return corsJson(
          req,
          {
            success: false,
            error: `Appointment is already '${existing.status}'`,
          },
          409,
        );
      }

      const { error: updateErr } = await supabase
        .from("appointments")
        .update({
          status,
          therapist_action_at: new Date().toISOString(),
          confirmation_token: null,
          confirmation_token_expires_at: null,
        })
        .eq("id", appointmentId);

      if (updateErr) {
        logger.error("PATCH update failed", { error: updateErr.message });
        return corsJson(
          req,
          { success: false, error: "Failed to update appointment" },
          500,
        );
      }

      logger.info("Appointment actioned via dashboard", {
        appointmentId,
        status,
      });
      return corsJson(req, { success: true, data: { appointmentId, status } });
    }

    // ── GET: dashboard data ────────────────────────────────
    const url = new URL(req.url);
    const statusFilter = url.searchParams.get("status");
    const limitParam = parseInt(url.searchParams.get("limit") ?? "50");
    const limit = isNaN(limitParam) ? 50 : Math.min(limitParam, 100);

    // ── Step 1: fetch appointments without PostgREST join ──
    // Avoids embed failures if the FK relationship isn't cached yet,
    // and gives us precise error messages if columns are missing.
    let apptQuery = supabase
      .from("appointments")
      .select(
        `id, status, start_time, end_time, appointment_type,
         patient_identifier, admin_notes, created_at, inquiry_id,
         confirmation_token_expires_at, therapist_action_at,
         therapist_rejection_reason`,
      )
      .eq("therapist_id", therapist.id)
      .order("start_time", { ascending: true })
      .limit(limit);

    if (statusFilter && statusFilter !== "all") {
      apptQuery = apptQuery.eq("status", statusFilter);
    } else {
      apptQuery = apptQuery.in("status", ["pending", "confirmed", "completed"]);
    }

    const { data: appointments, error: apptError } = await apptQuery;
    if (apptError) {
      // Surface the real PostgREST error — visible in Supabase function logs
      logger.error("Failed to fetch appointments", {
        error: apptError.message,
        code: apptError.code,
        details: apptError.details,
        hint: apptError.hint,
      });
      return corsJson(
        req,
        {
          success: false,
          error: `Failed to load appointments: ${apptError.message}`,
        },
        500,
      );
    }

    // ── Step 2: batch-fetch related inquiries ──────────────
    const inquiryIds = [
      ...new Set((appointments ?? []).map((a) => a.inquiry_id).filter(Boolean)),
    ];

    let inquiriesMap: Record<string, unknown> = {};
    if (inquiryIds.length > 0) {
      const { data: inquiries, error: inqError } = await supabase
        .from("inquiries")
        .select(
          "id, problem_description, extracted_conditions, primary_specialty, raw_chat_summary",
        )
        .in("id", inquiryIds);

      if (inqError) {
        // Non-fatal: dashboard still loads, inquiry details just show null
        logger.warn("Failed to fetch inquiries (non-fatal)", {
          error: inqError.message,
        });
      } else {
        inquiriesMap = Object.fromEntries(
          (inquiries ?? []).map((inq) => [inq.id, inq]),
        );
      }
    }

    // ── Step 3: merge inquiry into each appointment ────────
    const enrichedAppointments = (appointments ?? []).map((appt) => ({
      ...appt,
      inquiry: inquiriesMap[appt.inquiry_id] ?? null,
    }));

    // ── Step 4: aggregate stats across ALL appointments ────
    const { data: allStats, error: statsError } = await supabase
      .from("appointments")
      .select("status")
      .eq("therapist_id", therapist.id);

    if (statsError) {
      logger.warn("Failed to fetch stats (non-fatal)", {
        error: statsError.message,
      });
    }

    const statusCounts = (allStats ?? []).reduce(
      (acc: Record<string, number>, row) => {
        acc[row.status] = (acc[row.status] ?? 0) + 1;
        return acc;
      },
      {},
    );

    return corsJson(req, {
      success: true,
      data: {
        therapist,
        appointments: enrichedAppointments,
        stats: {
          pending: statusCounts["pending"] ?? 0,
          confirmed: statusCounts["confirmed"] ?? 0,
          completed: statusCounts["completed"] ?? 0,
          cancelled:
            (statusCounts["cancelled_by_patient"] ?? 0) +
            (statusCounts["cancelled_by_therapist"] ?? 0),
          total: allStats?.length ?? 0,
        },
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("Unhandled error", { message, err });
    return corsJson(
      req,
      { success: false, error: `Internal server error: ${message}` },
      500,
    );
  }
});
