// ============================================================
// AgentService.ts — Implements IAgentService using fetch + SSE
// Handles streaming from the agent-chat Supabase Edge Function
// ============================================================

import type { IAgentService } from "./IAgentService";
import type { SSEEvent } from "../types";
import { logger } from "../lib/logger";
import { logAndNormalize } from "../lib/errorHandler";

const CONTEXT = "AgentService";

export class AgentService implements IAgentService {
  private readonly edgeFunctionUrl: string;

  constructor() {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    this.edgeFunctionUrl = `${supabaseUrl}/functions/v1/agent-chat`;
    logger.info(CONTEXT, "AgentService initialized", {
      url: this.edgeFunctionUrl,
    });
  }

  streamMessage(
    message: string,
    sessionId?: string,
    onEvent: (event: SSEEvent) => void,
    onError: (error: Error) => void,
  ): () => void {
    logger.info(CONTEXT, "streamMessage called", {
      message: message.slice(0, 80),
      sessionId,
    });

    const abortController = new AbortController();

    this.executeStream(
      message,
      sessionId,
      onEvent,
      onError,
      abortController,
    ).catch((err) => {
      const normalized = logAndNormalize(CONTEXT, err);
      onError(new Error(normalized.message));
    });

    // Return cleanup function
    return () => {
      logger.info(CONTEXT, "Aborting SSE stream");
      abortController.abort();
    };
  }

  private async executeStream(
    message: string,
    sessionId: string | null,
    onEvent: (event: SSEEvent) => void,
    onError: (error: Error) => void,
    abortController: AbortController,
  ): Promise<void> {
    logger.info(CONTEXT, "Opening SSE connection to edge function");

    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

    let response: Response;
    try {
      //   response = await fetch(this.edgeFunctionUrl, {
      //     method: "POST",
      //     headers: {
      //       "Content-Type": "application/json",
      //       Authorization: `Bearer ${anonKey}`,
      //       Accept: "text/event-stream",
      //     },
      //     body: JSON.stringify({ message, sessionId }),
      //     signal: abortController.signal,

      //Undo protector
      const body: any = { message };
      if (sessionId) {
        body.sessionId = sessionId;
      }

      response = await fetch(this.edgeFunctionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${anonKey}`,
          Accept: "text/event-stream",
        },
        body: JSON.stringify(body),
        signal: abortController.signal,
      });
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        logger.info(CONTEXT, "SSE stream aborted by client");
        return;
      }
      throw err;
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => "unknown");
      logger.error(CONTEXT, "Edge function returned non-OK response", {
        status: response.status,
        body: errorText,
      });
      onError(new Error(`Server error ${response.status}: ${errorText}`));
      return;
    }

    if (!response.body) {
      logger.error(CONTEXT, "Response body is null — SSE not supported");
      onError(new Error("Server did not return a streaming response"));
      return;
    }

    logger.info(CONTEXT, "SSE stream connected, reading events");
    await this.readSSEStream(
      response.body,
      onEvent,
      onError,
      abortController.signal,
    );
  }

  private async readSSEStream(
    body: ReadableStream<Uint8Array>,
    onEvent: (event: SSEEvent) => void,
    onError: (error: Error) => void,
    signal: AbortSignal,
  ): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    logger.sse(CONTEXT, "Starting SSE reader loop");

    try {
      while (true) {
        if (signal.aborted) {
          logger.info(CONTEXT, "Signal aborted, exiting reader loop");
          break;
        }

        const { done, value } = await reader.read();
        if (done) {
          logger.sse(CONTEXT, "SSE stream ended by server");
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        // Keep the last partial line in the buffer
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const raw = line.slice(6).trim();
            if (raw === "[DONE]") {
              logger.sse(CONTEXT, "Received [DONE] sentinel");
              continue;
            }

            try {
              const event = JSON.parse(raw) as SSEEvent;
              logger.sse(CONTEXT, `Received SSE event: ${event.type}`, event);
              onEvent(event);
            } catch (parseErr) {
              logger.warn(CONTEXT, "Failed to parse SSE event JSON", {
                raw,
                parseErr,
              });
            }
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        logger.info(CONTEXT, "Reader aborted");
        return;
      }
      const normalized = logAndNormalize(CONTEXT, err);
      onError(new Error(normalized.message));
    } finally {
      logger.sse(CONTEXT, "Releasing SSE reader");
      reader.releaseLock();
    }
  }
}
