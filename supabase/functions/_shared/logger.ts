// ============================================================
// _shared/logger.ts
// Centralized logger — prefixed, leveled, grep-able in Supabase logs
// SOLID: SRP — logging is this module's only concern
// ============================================================

export type LogLevel = "INFO" | "WARN" | "ERROR" | "TOOL" | "AGENT" | "DB" | "CALENDAR";

interface LogEntry {
  level: LogLevel;
  context: string;
  message: string;
  data?: unknown;
  timestamp: string;
}

function formatEntry(entry: LogEntry): string {
  const base = `[${entry.timestamp}] [${entry.level}] [${entry.context}] ${entry.message}`;
  if (entry.data !== undefined) {
    try {
      return `${base} | ${JSON.stringify(entry.data)}`;
    } catch {
      return `${base} | [unserializable data]`;
    }
  }
  return base;
}

function log(level: LogLevel, context: string, message: string, data?: unknown): void {
  const entry: LogEntry = {
    level,
    context,
    message,
    data,
    timestamp: new Date().toISOString(),
  };

  const formatted = formatEntry(entry);

  if (level === "ERROR") {
    console.error(formatted);
  } else if (level === "WARN") {
    console.warn(formatted);
  } else {
    console.log(formatted);
  }
}

// Factory: createLogger("AgentOrchestrator") → logger scoped to that class
export function createLogger(context: string) {
  return {
    info: (message: string, data?: unknown) => log("INFO", context, message, data),
    warn: (message: string, data?: unknown) => log("WARN", context, message, data),
    error: (message: string, data?: unknown) => log("ERROR", context, message, data),
    tool: (message: string, data?: unknown) => log("TOOL", context, message, data),
    agent: (message: string, data?: unknown) => log("AGENT", context, message, data),
    db: (message: string, data?: unknown) => log("DB", context, message, data),
    calendar: (message: string, data?: unknown) => log("CALENDAR", context, message, data),
  };
}

export type Logger = ReturnType<typeof createLogger>;