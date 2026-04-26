// ============================================================
// _shared/validator.ts
// Input validation — pure functions, no side effects
// SOLID: SRP — validation only, throws ValidationError on failure
// ============================================================

import { ValidationError } from "./error.ts";
import { createLogger } from "./logger.ts";

const logger = createLogger("Validator");

// Validates the agent-chat request body
export interface ChatRequestBody {
  message: string;
  sessionId?: string;
  patientIdentifier?: string;
}

export function validateChatRequest(body: unknown): ChatRequestBody {
  logger.info("Validating chat request body");

  if (!body || typeof body !== "object") {
    throw new ValidationError("Request body must be a JSON object");
  }

  const b = body as Record<string, unknown>;

  if (!b.message || typeof b.message !== "string") {
    throw new ValidationError(
      "'message' field is required and must be a string",
    );
  }

  const message = b.message.trim();

  if (message.length === 0) {
    throw new ValidationError("'message' cannot be empty");
  }

  if (message.length > 4000) {
    throw new ValidationError(
      "'message' exceeds maximum length of 4000 characters",
    );
  }

  if (b.sessionId !== undefined && typeof b.sessionId !== "string") {
    throw new ValidationError("'sessionId' must be a string if provided");
  }

  if (
    b.patientIdentifier !== undefined &&
    typeof b.patientIdentifier !== "string"
  ) {
    throw new ValidationError(
      "'patientIdentifier' must be a string if provided",
    );
  }

  logger.info("Chat request validation passed", {
    messageLength: message.length,
    hasSessionId: !!b.sessionId,
  });

  return {
    message,
    sessionId: b.sessionId as string | undefined,
    patientIdentifier: b.patientIdentifier as string | undefined,
  };
}

// Validates UUID format (used for IDs coming from tool args)
export function validateUUID(value: unknown, fieldName: string): string {
  logger.info(`Validating UUID field: ${fieldName}`);

  if (!value || typeof value !== "string") {
    throw new ValidationError(`'${fieldName}' must be a non-empty string`);
  }

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(value)) {
    throw new ValidationError(`'${fieldName}' must be a valid UUID`);
  }

  return value;
}

// Validates an ISO 8601 datetime string
export function validateDatetime(value: unknown, fieldName: string): string {
  logger.info(`Validating datetime field: ${fieldName}`);

  if (!value || typeof value !== "string") {
    throw new ValidationError(`'${fieldName}' must be a non-empty string`);
  }

  const date = new Date(value);

  if (isNaN(date.getTime())) {
    throw new ValidationError(
      `'${fieldName}' must be a valid ISO 8601 datetime string`,
    );
  }

  if (date < new Date()) {
    throw new ValidationError(`'${fieldName}' must be a future datetime`);
  }

  return value;
}

// Validates admin request has a valid Authorization header
export function validateAdminAuth(req: Request): string {
  logger.info("Validating admin Authorization header");

  const authHeader = req.headers.get("Authorization");

  if (!authHeader) {
    throw new ValidationError("Authorization header is required");
  }

  if (!authHeader.startsWith("Bearer ")) {
    throw new ValidationError("Authorization header must be a Bearer token");
  }

  const token = authHeader.slice(7).trim();

  if (!token) {
    throw new ValidationError("Bearer token cannot be empty");
  }

  logger.info("Authorization header format validated");
  return token;
}
