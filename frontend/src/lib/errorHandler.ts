// ============================================================
// errorHandler.ts — Centralized error normalization
// Converts any thrown value into a consistent { code, message }
// ============================================================

import { logger } from './logger';

const CONTEXT = 'ErrorHandler';

export interface NormalizedError {
  code: string;
  message: string;
  originalError?: unknown;
}

export function normalizeError(error: unknown, fallbackCode = 'UNKNOWN_ERROR'): NormalizedError {
  logger.debug(CONTEXT, 'Normalizing error', error);

  // Supabase/fetch API error with code + message
  if (typeof error === 'object' && error !== null) {
    const e = error as Record<string, unknown>;

    if (typeof e.code === 'string' && typeof e.message === 'string') {
      return { code: e.code, message: e.message, originalError: error };
    }

    if (e.error && typeof e.error === 'object') {
      const inner = e.error as Record<string, unknown>;
      if (typeof inner.code === 'string' && typeof inner.message === 'string') {
        return { code: inner.code, message: inner.message, originalError: error };
      }
    }

    if (error instanceof Error) {
      return { code: fallbackCode, message: error.message, originalError: error };
    }
  }

  if (typeof error === 'string') {
    return { code: fallbackCode, message: error };
  }

  return { code: fallbackCode, message: 'An unexpected error occurred', originalError: error };
}

export function logAndNormalize(context: string, error: unknown): NormalizedError {
  const normalized = normalizeError(error);
  logger.error(context, `${normalized.code}: ${normalized.message}`, error);
  return normalized;
}