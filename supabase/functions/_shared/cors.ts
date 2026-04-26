// ============================================================
// _shared/cors.ts
// CORS headers — centralized so every edge function stays consistent
// ============================================================

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*", // Tighten to your domain in production
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-session-id",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

// Every edge function calls this first for preflight requests
export function handleCors(req: Request): Response | null {
  console.log("[CORS] Checking request method:", req.method);

  if (req.method === "OPTIONS") {
    console.log("[CORS] Handling preflight OPTIONS request");
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS,
    });
  }

  return null; // Not a preflight — continue processing
}

// Build a JSON response with CORS headers baked in
export function corsJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json",
    },
  });
}

// Build an SSE response with CORS headers for streaming
export function corsStream(stream: ReadableStream): Response {
  return new Response(stream, {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
