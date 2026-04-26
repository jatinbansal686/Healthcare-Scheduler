// ============================================================
// IAgentService.ts — Interface for agent chat service
// Depend on abstraction, not implementation (DIP)
// ============================================================

import type { SSEEvent } from '../types';

export interface IAgentService {
  /**
   * Open an SSE stream to the agent-chat edge function.
   * Calls onEvent for each parsed SSE event.
   * Returns a cleanup function that aborts the stream.
   */
  streamMessage(
    message: string,
    sessionId: string | null,
    onEvent: (event: SSEEvent) => void,
    onError: (error: Error) => void
  ): () => void;
}