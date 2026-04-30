

// ============================================================
// logger.ts — Frontend logger with leveled, prefixed output
// Mirrors backend logger pattern for consistent grep-able logs
// ============================================================

type LogLevel = "INFO" | "WARN" | "ERROR" | "DEBUG" | "SSE" | "SERVICE";

const isDev = import.meta.env.DEV;

function formatMessage(
  level: LogLevel,
  context: string,
  message: string,
): string {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level}] [${context}] ${message}`;
}

function log(
  level: LogLevel,
  context: string,
  message: string,
  data?: unknown,
): void {
  const formatted = formatMessage(level, context, message);

  switch (level) {
    case "ERROR":
      console.error(formatted, data !== undefined ? data : "");
      break;
    case "WARN":
      console.warn(formatted, data !== undefined ? data : "");
      break;
    case "DEBUG":
      if (isDev) {
        console.debug(formatted, data !== undefined ? data : "");
      }
      break;
    default:
      console.log(formatted, data !== undefined ? data : "");
  }
}

// ---- Public API ----

export const logger = {
  info: (context: string, message: string, data?: unknown) =>
    log("INFO", context, message, data),

  warn: (context: string, message: string, data?: unknown) =>
    log("WARN", context, message, data),

  error: (context: string, message: string, data?: unknown) =>
    log("ERROR", context, message, data),

  debug: (context: string, message: string, data?: unknown) =>
    log("DEBUG", context, message, data),

  sse: (context: string, message: string, data?: unknown) =>
    log("SSE", context, message, data),

  service: (context: string, message: string, data?: unknown) =>
    log("SERVICE", context, message, data),
};
