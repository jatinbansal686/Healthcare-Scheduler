// import { handleCors, corsJson } from "../_shared/cors.ts";
// import { createLogger } from "../_shared/logger.ts";
// import { normalizeError } from "../_shared/error.ts";
// import { getSupabaseAdmin, verifyUserToken } from "../_shared/supabaseAdmin.ts";
// import { validateAdminAuth } from "../_shared/validator.ts";

// const logger = createLogger("AdminDataFunction");

// Deno.serve(async (req: Request) => {
//   logger.info("admin-data function invoked", {
//     method: req.method,
//     url: req.url,
//   });

//   // ── CORS preflight ────────────────────────────────────────
//   const corsResponse = handleCors(req);
//   if (corsResponse) return corsResponse;

//   // ── Method guard ─────────────────────────────────────────
//   if (req.method !== "GET" && req.method !== "POST") {
//     logger.warn("Method not allowed", { method: req.method });
//     return corsJson(
//       req,
//       {
//         // ← was missing req
//         success: false,
//         error: {
//           code: "METHOD_NOT_ALLOWED",
//           message: "Only GET/POST accepted",
//         },
//       },
//       405,
//     );
//   }

//   try {
//     // ── Verify admin JWT ──────────────────────────────────────
//     logger.info("Verifying admin authentication");
//     const token = validateAdminAuth(req);
//     const user = await verifyUserToken(token);
//     logger.info("Admin authenticated successfully", {
//       userId: user.id,
//       email: user.email,
//     });

//     const supabase = getSupabaseAdmin();

//     // ── Parse pagination / filter params ─────────────────────
//     const url = new URL(req.url);
//     const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
//     const limit = Math.min(
//       100,
//       Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10)),
//     );
//     const offset = (page - 1) * limit;
//     const statusFilter = url.searchParams.get("status");

//     logger.info("Request params parsed", { page, limit, offset, statusFilter });

//     // ── Fetch inquiries ───────────────────────────────────────
//     logger.db("Querying inquiries table");

//     let inquiriesQuery = supabase
//       .from("inquiries")
//       .select(
//         `
//         id,
//         patient_identifier,
//         problem_description,
//         extracted_conditions,
//         primary_specialty,
//         insurance_info,
//         requested_schedule,
//         status,
//         raw_chat_summary,
//         agent_loop_count,
//         failure_reason,
//         created_at,
//         updated_at,
//         therapists!matched_therapist_id (
//           id,
//           name
//         )
//         `,
//         { count: "exact" },
//       )
//       .order("created_at", { ascending: false })
//       .range(offset, offset + limit - 1);

//     if (statusFilter) {
//       logger.info("Applying status filter", { statusFilter });
//       inquiriesQuery = inquiriesQuery.eq("status", statusFilter);
//     }

//     const {
//       data: inquiries,
//       error: inquiriesError,
//       count: inquiriesCount,
//     } = await inquiriesQuery;

//     if (inquiriesError) {
//       logger.error("Failed to fetch inquiries", {
//         error: inquiriesError.message,
//         code: inquiriesError.code,
//       });
//       throw new Error(`Failed to fetch inquiries: ${inquiriesError.message}`);
//     }

//     logger.db(
//       `Fetched ${inquiries?.length ?? 0} inquiries (total: ${inquiriesCount})`,
//     );

//     // ── Fetch appointments ────────────────────────────────────
//     logger.db("Querying appointments table");

//     const { data: appointments, error: appointmentsError } = await supabase
//       .from("appointments")
//       .select(
//         `
//         id,
//         patient_identifier,
//         start_time,
//         end_time,
//         status,
//         appointment_type,
//         google_calendar_event_id,
//         admin_notes,
//         created_at,
//         therapists!therapist_id (
//           id,
//           name,
//           email
//         )
//         `,
//       )
//       .order("start_time", { ascending: false })
//       .limit(50);

//     if (appointmentsError) {
//       logger.error("Failed to fetch appointments", {
//         error: appointmentsError.message,
//         code: appointmentsError.code,
//       });
//       throw new Error(
//         `Failed to fetch appointments: ${appointmentsError.message}`,
//       );
//     }

//     logger.db(`Fetched ${appointments?.length ?? 0} appointments`);

//     // ── Compute dashboard stats ───────────────────────────────
//     logger.db("Computing dashboard statistics");

//     const { data: allStatuses, error: statsError } = await supabase
//       .from("inquiries")
//       .select("status");

//     if (statsError) {
//       logger.warn("Failed to compute stats (non-fatal)", {
//         error: statsError.message,
//       });
//     }

//     const statusCounts = (allStatuses ?? []).reduce(
//       (acc: Record<string, number>, row: { status: string }) => {
//         acc[row.status] = (acc[row.status] ?? 0) + 1;
//         return acc;
//       },
//       {},
//     );

//     const { count: upcomingCount } = await supabase
//       .from("appointments")
//       .select("id", { count: "exact", head: true })
//       .eq("status", "confirmed")
//       .gt("start_time", new Date().toISOString());

//     logger.info("Admin data fetch complete", {
//       inquiriesReturned: inquiries?.length ?? 0,
//       appointmentsReturned: appointments?.length ?? 0,
//       totalInquiries: allStatuses?.length ?? 0,
//     });

//     return corsJson(req, {
//       success: true,
//       data: {
//         inquiries: inquiries ?? [],
//         appointments: appointments ?? [],
//         pagination: {
//           page,
//           limit,
//           total: inquiriesCount ?? 0,
//           totalPages: Math.ceil((inquiriesCount ?? 0) / limit),
//         },
//         stats: {
//           totalInquiries: allStatuses?.length ?? 0,
//           byStatus: statusCounts,
//           upcomingAppointments: upcomingCount ?? 0,
//         },
//       },
//     });
//   } catch (err) {
//     logger.error("Unhandled error in admin-data function", err);
//     const normalized = normalizeError(err);
//     return corsJson(
//       req,
//       {
//         // ← was missing req
//         success: false,
//         error: { code: normalized.code, message: normalized.message },
//       },
//       normalized.statusCode,
//     );
//   }
// });

import { handleCors, corsJson } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logger.ts";
import { normalizeError } from "../_shared/error.ts";
import { getSupabaseAdmin, verifyUserToken } from "../_shared/supabaseAdmin.ts";
import { validateAdminAuth } from "../_shared/validator.ts";

const logger = createLogger("AdminDataFunction");

Deno.serve(async (req: Request) => {
  logger.info("admin-data function invoked", {
    method: req.method,
    url: req.url,
  });

  // ── CORS preflight ────────────────────────────────────────
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // ── Method guard ─────────────────────────────────────────
  if (req.method !== "GET" && req.method !== "POST") {
    logger.warn("Method not allowed", { method: req.method });
    return corsJson(
      req,
      {
        success: false,
        error: {
          code: "METHOD_NOT_ALLOWED",
          message: "Only GET/POST accepted",
        },
      },
      405,
    );
  }

  try {
    // ── Verify admin JWT ──────────────────────────────────────
    logger.info("Verifying admin authentication");
    const token = validateAdminAuth(req);
    const user = await verifyUserToken(token);
    logger.info("Admin authenticated successfully", {
      userId: user.id,
      email: user.email,
    });

    const supabase = getSupabaseAdmin();

    // ── Parse pagination / filter params ─────────────────────
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10)),
    );
    const offset = (page - 1) * limit;
    const statusFilter = url.searchParams.get("status");

    logger.info("Request params parsed", { page, limit, offset, statusFilter });

    // ── Fetch inquiries ───────────────────────────────────────
    logger.db("Querying inquiries table");

    let inquiriesQuery = supabase
      .from("inquiries")
      .select(
        `
        id,
        patient_identifier,
        problem_description,
        extracted_conditions,
        primary_specialty,
        insurance_info,
        requested_schedule,
        status,
        raw_chat_summary,
        agent_loop_count,
        failure_reason,
        created_at,
        updated_at,
        therapists!matched_therapist_id (
          id,
          name
        )
        `,
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (statusFilter) {
      logger.info("Applying status filter", { statusFilter });
      inquiriesQuery = inquiriesQuery.eq("status", statusFilter);
    }

    const {
      data: inquiries,
      error: inquiriesError,
      count: inquiriesCount,
    } = await inquiriesQuery;

    if (inquiriesError) {
      logger.error("Failed to fetch inquiries", {
        error: inquiriesError.message,
        code: inquiriesError.code,
      });
      throw new Error(`Failed to fetch inquiries: ${inquiriesError.message}`);
    }

    logger.db(
      `Fetched ${inquiries?.length ?? 0} inquiries (total: ${inquiriesCount})`,
    );

    // ── Fetch appointments ────────────────────────────────────
    logger.db("Querying appointments table");

    const { data: appointments, error: appointmentsError } = await supabase
      .from("appointments")
      .select(
        `
        id,
        patient_identifier,
        start_time,
        end_time,
        status,
        appointment_type,
        google_calendar_event_id,
        admin_notes,
        created_at,
        therapists!therapist_id (
          id,
          name,
          email
        )
        `,
      )
      .order("start_time", { ascending: false })
      .limit(50); // Latest 50 appointments for dashboard

    if (appointmentsError) {
      logger.error("Failed to fetch appointments", {
        error: appointmentsError.message,
        code: appointmentsError.code,
      });
      throw new Error(
        `Failed to fetch appointments: ${appointmentsError.message}`,
      );
    }

    logger.db(`Fetched ${appointments?.length ?? 0} appointments`);

    // ── Fetch therapists (NEW) ────────────────────────────────
    logger.db("Querying therapists table");

    const { data: therapists, error: therapistsError } = await supabase
      .from("therapists")
      .select(
        `
        id,
        name,
        specialties,
        accepted_insurance,
        bio,
        avatar_url,
        google_calendar_id,
        created_at
        `,
      )
      .order("name", { ascending: true });

    if (therapistsError) {
      // Non-fatal — log and continue with empty array
      logger.warn("Failed to fetch therapists (non-fatal)", {
        error: therapistsError.message,
      });
    }

    logger.db(`Fetched ${therapists?.length ?? 0} therapists`);

    // ── Compute dashboard stats ───────────────────────────────
    logger.db("Computing dashboard statistics");

    const { data: allStatuses, error: statsError } = await supabase
      .from("inquiries")
      .select("status");

    if (statsError) {
      // Non-fatal — stats are nice-to-have
      logger.warn("Failed to compute stats (non-fatal)", {
        error: statsError.message,
      });
    }

    const statusCounts = (allStatuses ?? []).reduce(
      (acc: Record<string, number>, row: { status: string }) => {
        acc[row.status] = (acc[row.status] ?? 0) + 1;
        return acc;
      },
      {},
    );

    // Count upcoming confirmed appointments (original logic — kept intact)
    const { count: upcomingCount } = await supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("status", "confirmed")
      .gt("start_time", new Date().toISOString());

    // Count scheduled appointments for the stat card
    const scheduledAppointmentsCount = (appointments ?? []).filter(
      (a: { status: string }) =>
        a.status === "confirmed" || a.status === "scheduled",
    ).length;

    logger.info("Admin data fetch complete", {
      inquiriesReturned: inquiries?.length ?? 0,
      appointmentsReturned: appointments?.length ?? 0,
      therapistsReturned: therapists?.length ?? 0,
      totalInquiries: allStatuses?.length ?? 0,
    });

    return corsJson(req, {
      success: true,
      data: {
        inquiries: inquiries ?? [],
        appointments: appointments ?? [],
        therapists: therapists ?? [], // NEW
        pagination: {
          page,
          limit,
          total: inquiriesCount ?? 0,
          totalPages: Math.ceil((inquiriesCount ?? 0) / limit),
        },
        // FIX: stats now includes all fields the frontend AdminStats type expects
        stats: {
          totalInquiries: allStatuses?.length ?? 0,
          pendingInquiries: statusCounts["pending"] ?? 0, // NEW
          scheduledAppointments: scheduledAppointmentsCount, // NEW
          totalTherapists: therapists?.length ?? 0, // NEW
          byStatus: statusCounts, // original — kept
          upcomingAppointments: upcomingCount ?? 0, // original — kept
        },
      },
    });
  } catch (err) {
    logger.error("Unhandled error in admin-data function", err);
    const normalized = normalizeError(err);
    return corsJson(
      req,
      {
        success: false,
        error: { code: normalized.code, message: normalized.message },
      },
      normalized.statusCode,
    );
  }
});
