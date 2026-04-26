// ============================================================
// _shared/error.ts
// Typed error hierarchy — every layer has its own error class
// SOLID: OCP — add new error types without touching existing ones
// ============================================================

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "DATABASE_ERROR"
  | "AI_PROVIDER_ERROR"
  | "CALENDAR_ERROR"
  | "AUTH_ERROR"
  | "NOT_FOUND_ERROR"
  | "TOOL_EXECUTION_ERROR"
  | "SESSION_ERROR"
  | "RATE_LIMIT_ERROR"
  | "UNKNOWN_ERROR";

// Base application error — all custom errors extend this
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly isOperational: boolean; // true = expected error, false = programmer error

  constructor(
    message: string,
    code: ErrorCode,
    statusCode = 500,
    isOperational = true
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    // Maintains proper stack trace in V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON() {
    return {
      error: {
        name: this.name,
        code: this.code,
        message: this.message,
        statusCode: this.statusCode,
      },
    };
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, "VALIDATION_ERROR", 400);
  }
}

export class DatabaseError extends AppError {
  public readonly originalError?: unknown;

  constructor(message: string, originalError?: unknown) {
    super(message, "DATABASE_ERROR", 500);
    this.originalError = originalError;
  }
}

export class AIProviderError extends AppError {
  public readonly originalError?: unknown;

  constructor(message: string, originalError?: unknown) {
    super(message, "AI_PROVIDER_ERROR", 502);
    this.originalError = originalError;
  }
}

export class CalendarError extends AppError {
  public readonly originalError?: unknown;

  constructor(message: string, originalError?: unknown) {
    super(message, "CALENDAR_ERROR", 502);
    this.originalError = originalError;
  }
}

export class AuthError extends AppError {
  constructor(message: string) {
    super(message, "AUTH_ERROR", 401);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, "NOT_FOUND_ERROR", 404);
  }
}

export class ToolExecutionError extends AppError {
  public readonly toolName: string;
  public readonly originalError?: unknown;

  constructor(toolName: string, message: string, originalError?: unknown) {
    super(`Tool '${toolName}' failed: ${message}`, "TOOL_EXECUTION_ERROR", 500);
    this.toolName = toolName;
    this.originalError = originalError;
  }
}

export class SessionError extends AppError {
  constructor(message: string) {
    super(message, "SESSION_ERROR", 500);
  }
}

export class RateLimitError extends AppError {
  constructor(provider: string) {
    super(`Rate limit exceeded for ${provider}`, "RATE_LIMIT_ERROR", 429);
  }
}

// Type guard — is this one of our known errors?
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

// Normalize any thrown value into a structured response object
export function normalizeError(error: unknown): {
  code: ErrorCode;
  message: string;
  statusCode: number;
} {
  if (isAppError(error)) {
    return {
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
    };
  }

  if (error instanceof Error) {
    return {
      code: "UNKNOWN_ERROR",
      message: error.message,
      statusCode: 500,
    };
  }

  return {
    code: "UNKNOWN_ERROR",
    message: "An unexpected error occurred",
    statusCode: 500,
  };
}