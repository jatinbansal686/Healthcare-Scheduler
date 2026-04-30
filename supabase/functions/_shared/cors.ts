// ============================================================
// _shared/cors.ts
// CORS headers — centralized so every edge function stays consistent
// ============================================================

// Add your domains here — no trailing slash
const ALLOWED_ORIGINS = [
  "http://localhost:5173", // local dev
  "https://healthcare-scheduler-seven.vercel.app", // ← replace with your Vercel URL
  // "https://your-custom-domain.com",            // uncomment if you add a custom domain
];

function getAllowedOrigin(req: Request): string {
  const origin = req.headers.get("origin") ?? "";
  return ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
}

export function getCorsHeaders(req: Request): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": getAllowedOrigin(req),
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-session-id",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
  };
}

// Every edge function calls this first for preflight requests
export function handleCors(req: Request): Response | null {
  console.log("[CORS] Checking request method:", req.method);

  if (req.method === "OPTIONS") {
    console.log("[CORS] Handling preflight OPTIONS request");
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(req),
    });
  }

  return null; // Not a preflight — continue processing
}

// Build a JSON response with CORS headers baked in
export function corsJson(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...getCorsHeaders(req),
      "Content-Type": "application/json",
    },
  });
}

// Build an SSE response with CORS headers for streaming
export function corsStream(req: Request, stream: ReadableStream): Response {
  return new Response(stream, {
    status: 200,
    headers: {
      ...getCorsHeaders(req),
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

// Backwards-compatible export for any file still using CORS_HEADERS directly
// (replace usages with getCorsHeaders(req) when possible)
export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-session-id",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
