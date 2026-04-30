// // ============================================================
// // useAgentChat.ts — Manages agent chat state + SSE streaming
// // OCP: Extended to parse slots from agent messages.
// //      All existing event handling logic unchanged.
// // ============================================================

// import { useState, useCallback, useRef, useEffect } from "react";
// import { v4 as uuidv4 } from "uuid";
// import type {
//   ChatMessage,
//   AgentChatState,
//   SSEEvent,
//   ToolProgressEvent,
//   AvailableSlot,
// } from "../types/agent.types";
// import { AgentService } from "../services/AgentService";
// import { logger } from "../lib/logger";
// import { logAndNormalize } from "../lib/errorHandler";
// import { parseSlots } from "../lib/slotParser";

// const CONTEXT = "useAgentChat";

// const agentService = new AgentService();

// const TOOL_LABELS: Record<string, string> = {
//   extractStructuredInfo: "Understanding your situation…",
//   saveInquiry: "Saving your inquiry…",
//   findTherapists: "Searching for matching therapists…",
//   checkAvailability: "Checking calendar availability…",
//   bookAppointment: "Booking your appointment…",
//   updateAppointmentStatus: "Updating appointment status…",
//   getTherapistProfile: "Loading therapist profile…",
//   sendConfirmation: "Preparing confirmation…",
// };

// function makeToolLabel(toolName: string): string {
//   return TOOL_LABELS[toolName] ?? `Running ${toolName}…`;
// }

// export interface UseAgentChatReturn extends AgentChatState {
//   sendMessage: (text: string) => void;
//   handleSlotSelect: (slot: AvailableSlot) => void;
//   resetChat: () => void;
// }

// export function useAgentChat(): UseAgentChatReturn {
//   logger.debug(CONTEXT, "useAgentChat hook initialized");

//   const [state, setState] = useState<AgentChatState>({
//     sessionId: null,
//     messages: [],
//     isLoading: false,
//     activeTools: [],
//     error: null,
//   });

//   // Track the last therapist seen from checkAvailability tool events
//   // so we can attach therapist context to parsed slots
//   const lastTherapistRef = useRef<{ id?: string; name?: string }>({});

//   const streamingTextRef = useRef<string>("");
//   const streamingMessageIdRef = useRef<string | null>(null);
//   const cleanupRef = useRef<(() => void) | null>(null);

//   useEffect(() => {
//     return () => {
//       if (cleanupRef.current) {
//         logger.info(CONTEXT, "Cleaning up active stream on unmount");
//         cleanupRef.current();
//       }
//     };
//   }, []);

//   const handleSSEEvent = useCallback((event: SSEEvent) => {
//     logger.sse(CONTEXT, `Handling SSE event: ${event.type}`, event);

//     switch (event.type) {
//       case "agent_thinking": {
//         logger.info(CONTEXT, "Agent is thinking...");
//         break;
//       }

//       case "agent_message": {
//         logger.info(CONTEXT, "Agent message received");

//         // deno-lint-ignore no-explicit-any
//         const messageText = (event as any).data?.message ?? "";

//         // ── Parse slots from the message text ─────────────────
//         // Uses the last seen therapist context from tool events.
//         // parseSlots returns [] if the message isn't a slot-offering message.
//         const slots = parseSlots(
//           messageText,
//           lastTherapistRef.current.name,
//           lastTherapistRef.current.id,
//         );

//         logger.info(CONTEXT, "Slot parse result", { slotCount: slots.length });

//         const newMessage: ChatMessage = {
//           id: uuidv4(),
//           sender: "agent",
//           text: messageText,
//           timestamp: new Date().toISOString(),
//           // Only attach slots if we actually found some
//           slots: slots.length > 0 ? slots : undefined,
//         };

//         setState((prev) => ({
//           ...prev,
//           messages: [...prev.messages, newMessage],
//         }));

//         break;
//       }

//       case "tool_start": {
//         // deno-lint-ignore no-explicit-any
//         const ev = event as any;
//         const toolName = ev.toolName ?? ev.data?.toolName ?? "";
//         logger.info(CONTEXT, `Tool started: ${toolName}`);

//         const progress: ToolProgressEvent = {
//           toolName,
//           status: "running",
//           label: makeToolLabel(toolName),
//         };
//         setState((prev) => ({
//           ...prev,
//           activeTools: [...prev.activeTools, progress],
//         }));
//         break;
//       }

//       case "tool_end": {
//         // deno-lint-ignore no-explicit-any
//         const ev = event as any;
//         const toolName = ev.toolName ?? ev.data?.toolName ?? "";
//         const success = ev.success ?? ev.data?.success ?? true;
//         const durationMs = ev.durationMs ?? ev.data?.durationMs ?? 0;

//         logger.info(CONTEXT, `Tool ended: ${toolName}`, {
//           success,
//           durationMs,
//         });

//         // Capture therapist name from checkAvailability result
//         // so slot parser can attach it to slot cards
//         if (toolName === "checkAvailability") {
//           // deno-lint-ignore no-explicit-any
//           const result = ev.result ?? (ev.data?.result as any);
//           if (result?.therapistName) {
//             lastTherapistRef.current.name = result.therapistName;
//             logger.info(CONTEXT, "Captured therapist name for slots", {
//               name: result.therapistName,
//             });
//           }
//           if (result?.therapistId) {
//             lastTherapistRef.current.id = result.therapistId;
//           }
//         }

//         setState((prev) => ({
//           ...prev,
//           activeTools: prev.activeTools.map((t) =>
//             t.toolName === toolName
//               ? { ...t, status: success ? "done" : "error", durationMs }
//               : t,
//           ),
//         }));
//         break;
//       }

//       case "done": {
//         logger.info(CONTEXT, "Conversation done");
//         // deno-lint-ignore no-explicit-any
//         const ev = event as any;
//         const sessionId = ev.data?.sessionId ?? ev.sessionId ?? null;

//         setState((prev) => ({
//           ...prev,
//           sessionId,
//           isLoading: false,
//           activeTools: [],
//         }));
//         break;
//       }

//       case "text_delta": {
//         // deno-lint-ignore no-explicit-any
//         const ev = event as any;
//         streamingTextRef.current += ev.delta ?? "";

//         setState((prev) => {
//           if (!streamingMessageIdRef.current) {
//             const newId = uuidv4();
//             streamingMessageIdRef.current = newId;
//             const newMessage: ChatMessage = {
//               id: newId,
//               sender: "agent",
//               text: streamingTextRef.current,
//               timestamp: new Date().toISOString(),
//             };
//             return { ...prev, messages: [...prev.messages, newMessage] };
//           }

//           return {
//             ...prev,
//             messages: prev.messages.map((m) =>
//               m.id === streamingMessageIdRef.current
//                 ? { ...m, text: streamingTextRef.current }
//                 : m,
//             ),
//           };
//         });
//         break;
//       }

//       case "message_complete": {
//         logger.info(CONTEXT, "Message complete received");
//         // deno-lint-ignore no-explicit-any
//         const ev = event as any;
//         const completedMessageId = streamingMessageIdRef.current;
//         streamingTextRef.current = "";
//         streamingMessageIdRef.current = null;

//         setState((prev) => {
//           const completedTools = prev.activeTools;
//           return {
//             ...prev,
//             sessionId: ev.sessionId ?? prev.sessionId,
//             isLoading: false,
//             activeTools: [],
//             messages: prev.messages.map((m) =>
//               m.id === completedMessageId
//                 ? {
//                     ...m,
//                     text: ev.finalText ?? m.text,
//                     toolProgress: completedTools,
//                   }
//                 : m,
//             ),
//           };
//         });
//         break;
//       }

//       case "error": {
//         // deno-lint-ignore no-explicit-any
//         const ev = event as any;
//         const errMsg = ev.message ?? ev.data?.message ?? "An error occurred";
//         logger.error(CONTEXT, `SSE error event`, errMsg);
//         setState((prev) => ({
//           ...prev,
//           isLoading: false,
//           activeTools: [],
//           error: errMsg,
//         }));
//         break;
//       }

//       default: {
//         logger.warn(CONTEXT, "Unknown SSE event type", event);
//       }
//     }
//   }, []);

//   const handleStreamError = useCallback((error: Error) => {
//     logger.error(CONTEXT, "Stream error", error);
//     const normalized = logAndNormalize(CONTEXT, error);
//     setState((prev) => ({
//       ...prev,
//       isLoading: false,
//       activeTools: [],
//       error: normalized.message,
//     }));
//   }, []);

//   const sendMessage = useCallback(
//     (text: string) => {
//       logger.info(CONTEXT, "sendMessage called", { text: text.slice(0, 80) });

//       if (!text.trim()) {
//         logger.warn(CONTEXT, "sendMessage called with empty text");
//         return;
//       }

//       if (cleanupRef.current) {
//         logger.info(
//           CONTEXT,
//           "Aborting previous stream before sending new message",
//         );
//         cleanupRef.current();
//         cleanupRef.current = null;
//       }

//       const userMessage: ChatMessage = {
//         id: uuidv4(),
//         sender: "user",
//         text: text.trim(),
//         timestamp: new Date().toISOString(),
//       };

//       setState((prev) => ({
//         ...prev,
//         isLoading: true,
//         error: null,
//         activeTools: [],
//         messages: [...prev.messages, userMessage],
//       }));

//       streamingTextRef.current = "";
//       streamingMessageIdRef.current = null;

//       const cleanup = agentService.streamMessage(
//         text.trim(),
//         state.sessionId,
//         handleSSEEvent,
//         handleStreamError,
//       );

//       cleanupRef.current = cleanup;
//       logger.info(CONTEXT, "SSE stream started");
//     },
//     [state.sessionId, handleSSEEvent, handleStreamError],
//   );

//   // Called when patient taps a slot card.
//   // Sends a natural-language booking message so the agent
//   // receives it exactly like a typed user message.
//   const handleSlotSelect = useCallback(
//     (slot: AvailableSlot) => {
//       logger.info(CONTEXT, "Slot selected by patient", { label: slot.label });

//       const bookingMessage = `I'd like to book the ${slot.label} slot${
//         slot.therapistName ? ` with ${slot.therapistName}` : ""
//       }`;

//       sendMessage(bookingMessage);
//     },
//     [sendMessage],
//   );

//   const resetChat = useCallback(() => {
//     logger.info(CONTEXT, "resetChat called");

//     if (cleanupRef.current) {
//       cleanupRef.current();
//       cleanupRef.current = null;
//     }

//     streamingTextRef.current = "";
//     streamingMessageIdRef.current = null;
//     lastTherapistRef.current = {};

//     setState({
//       sessionId: null,
//       messages: [],
//       isLoading: false,
//       activeTools: [],
//       error: null,
//     });
//   }, []);

//   return { ...state, sendMessage, handleSlotSelect, resetChat };
// }

// ============================================================
// useAgentChat.ts — Manages agent chat state + SSE streaming
// CHANGE: Added handler for `structured_message` SSE event.
//         Populates ChatMessage.structuredData directly from the
//         typed tool payload — zero regex parsing for structured responses.
//         Legacy `agent_message` handler kept 100% unchanged as fallback.
// ============================================================

import { useState, useCallback, useRef, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import type {
  ChatMessage,
  AgentChatState,
  SSEEvent,
  ToolProgressEvent,
  AvailableSlot,
  StructuredMessageData,
} from "../types/agent.types";
import { AgentService } from "../services/AgentService";
import { logger } from "../lib/logger";
import { logAndNormalize } from "../lib/errorHandler";
import { parseSlots } from "../lib/slotParser";

const CONTEXT = "useAgentChat";

const agentService = new AgentService();

const TOOL_LABELS: Record<string, string> = {
  extractStructuredInfo: "Understanding your situation…",
  saveInquiry: "Saving your inquiry…",
  findTherapists: "Searching for matching therapists…",
  checkAvailability: "Checking calendar availability…",
  bookAppointment: "Booking your appointment…",
  updateAppointmentStatus: "Updating appointment status…",
  getTherapistProfile: "Loading therapist profile…",
  sendConfirmation: "Preparing confirmation…",
  respondToUser: "Preparing response…",
};

function makeToolLabel(toolName: string): string {
  return TOOL_LABELS[toolName] ?? `Running ${toolName}…`;
}

export interface UseAgentChatReturn extends AgentChatState {
  sendMessage: (text: string) => void;
  handleSlotSelect: (slot: AvailableSlot) => void;
  resetChat: () => void;
}

export function useAgentChat(): UseAgentChatReturn {
  logger.debug(CONTEXT, "useAgentChat hook initialized");

  const [state, setState] = useState<AgentChatState>({
    sessionId: null,
    messages: [],
    isLoading: false,
    activeTools: [],
    error: null,
  });

  const lastTherapistRef = useRef<{ id?: string; name?: string }>({});
  const streamingTextRef = useRef<string>("");
  const streamingMessageIdRef = useRef<string | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        logger.info(CONTEXT, "Cleaning up active stream on unmount");
        cleanupRef.current();
      }
    };
  }, []);

  const handleSSEEvent = useCallback((event: SSEEvent) => {
    logger.sse(CONTEXT, `Handling SSE event: ${event.type}`, event);

    switch (event.type) {
      // ── NEW: Structured message from respondToUser tool ─────
      // Primary path — AI called respondToUser correctly.
      // Attach typed structuredData directly; no regex needed.
      case "structured_message": {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ev = event as any;
        const payload = ev.data ?? {};
        const messageText: string = payload.message ?? "";
        const uiHint = payload.ui_hint ?? "text";

        logger.info(CONTEXT, "Structured message received", {
          ui_hint: uiHint,
          hasSlots: !!payload.slots,
          hasTherapists: !!payload.therapists,
          hasConfirmation: !!payload.confirmation,
        });

        // Map backend slot shape → frontend AvailableSlot shape
        // Backend sends { startTime, endTime, label, therapistId, therapistName }
        // which already matches AvailableSlot — just coerce the array.
        const slots: AvailableSlot[] | null =
          Array.isArray(payload.slots) && payload.slots.length > 0
            ? payload.slots.map((s: Record<string, string>) => ({
                label: s.label ?? s.startTime,
                startTime: s.startTime,
                endTime: s.endTime,
                therapistId: s.therapistId,
                therapistName: s.therapistName,
              }))
            : null;

        const structuredData: StructuredMessageData = {
          ui_hint: uiHint,
          slots,
          therapists: payload.therapists ?? null,
          confirmation: payload.confirmation ?? null,
        };

        const newMessage: ChatMessage = {
          id: uuidv4(),
          sender: "agent",
          text: messageText,
          timestamp: new Date().toISOString(),
          // Structured data takes priority over legacy slot parsing
          structuredData,
          // Also populate legacy slots field so existing SlotCards render
          // without any change to MessageBubble/SlotCards components
          slots: slots ?? undefined,
        };

        setState((prev) => ({
          ...prev,
          messages: [...prev.messages, newMessage],
        }));
        break;
      }

      // ── LEGACY: agent_message (fallback path) ──────────────
      // Kept 100% unchanged. Handles models that ignore respondToUser.
      case "agent_message": {
        logger.info(
          CONTEXT,
          "Legacy agent_message received — using regex parser fallback",
        );

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const messageText = (event as any).data?.message ?? "";

        const slots = parseSlots(
          messageText,
          lastTherapistRef.current.name,
          lastTherapistRef.current.id,
        );

        logger.info(CONTEXT, "Slot parse result (legacy)", {
          slotCount: slots.length,
        });

        const newMessage: ChatMessage = {
          id: uuidv4(),
          sender: "agent",
          text: messageText,
          timestamp: new Date().toISOString(),
          slots: slots.length > 0 ? slots : undefined,
        };

        setState((prev) => ({
          ...prev,
          messages: [...prev.messages, newMessage],
        }));
        break;
      }

      case "agent_thinking": {
        logger.info(CONTEXT, "Agent is thinking...");
        break;
      }

      case "tool_start": {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ev = event as any;
        const toolName = ev.toolName ?? ev.data?.toolName ?? "";
        logger.info(CONTEXT, `Tool started: ${toolName}`);

        // Don't show respondToUser in the tool progress bar —
        // it's an internal implementation detail, not a user-visible operation
        if (toolName === "respondToUser") break;

        const progress: ToolProgressEvent = {
          toolName,
          status: "running",
          label: makeToolLabel(toolName),
        };
        setState((prev) => ({
          ...prev,
          activeTools: [...prev.activeTools, progress],
        }));
        break;
      }

      case "tool_end": {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ev = event as any;
        const toolName = ev.toolName ?? ev.data?.toolName ?? "";
        const success = ev.success ?? ev.data?.success ?? true;
        const durationMs = ev.durationMs ?? ev.data?.durationMs ?? 0;

        logger.info(CONTEXT, `Tool ended: ${toolName}`, {
          success,
          durationMs,
        });

        if (toolName === "respondToUser") break;

        // Capture therapist context for legacy slot parser fallback
        if (toolName === "checkAvailability") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = ev.result ?? (ev.data?.result as any);
          if (result?.therapistName) {
            lastTherapistRef.current.name = result.therapistName;
          }
          if (result?.therapistId) {
            lastTherapistRef.current.id = result.therapistId;
          }
        }

        setState((prev) => ({
          ...prev,
          activeTools: prev.activeTools.map((t) =>
            t.toolName === toolName
              ? { ...t, status: success ? "done" : "error", durationMs }
              : t,
          ),
        }));
        break;
      }

      case "done": {
        logger.info(CONTEXT, "Conversation done");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ev = event as any;
        const sessionId = ev.data?.sessionId ?? ev.sessionId ?? null;
        setState((prev) => ({
          ...prev,
          sessionId,
          isLoading: false,
          activeTools: [],
        }));
        break;
      }

      case "text_delta": {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ev = event as any;
        streamingTextRef.current += ev.delta ?? "";
        setState((prev) => {
          if (!streamingMessageIdRef.current) {
            const newId = uuidv4();
            streamingMessageIdRef.current = newId;
            const newMessage: ChatMessage = {
              id: newId,
              sender: "agent",
              text: streamingTextRef.current,
              timestamp: new Date().toISOString(),
            };
            return { ...prev, messages: [...prev.messages, newMessage] };
          }
          return {
            ...prev,
            messages: prev.messages.map((m) =>
              m.id === streamingMessageIdRef.current
                ? { ...m, text: streamingTextRef.current }
                : m,
            ),
          };
        });
        break;
      }

      case "message_complete": {
        logger.info(CONTEXT, "Message complete received");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ev = event as any;
        const completedMessageId = streamingMessageIdRef.current;
        streamingTextRef.current = "";
        streamingMessageIdRef.current = null;
        setState((prev) => {
          const completedTools = prev.activeTools;
          return {
            ...prev,
            sessionId: ev.sessionId ?? prev.sessionId,
            isLoading: false,
            activeTools: [],
            messages: prev.messages.map((m) =>
              m.id === completedMessageId
                ? {
                    ...m,
                    text: ev.finalText ?? m.text,
                    toolProgress: completedTools,
                  }
                : m,
            ),
          };
        });
        break;
      }

      case "error": {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ev = event as any;
        const errMsg = ev.message ?? ev.data?.message ?? "An error occurred";
        logger.error(CONTEXT, `SSE error event`, errMsg);
        setState((prev) => ({
          ...prev,
          isLoading: false,
          activeTools: [],
          error: errMsg,
        }));
        break;
      }

      default: {
        logger.warn(CONTEXT, "Unknown SSE event type", event);
      }
    }
  }, []);

  const handleStreamError = useCallback((error: Error) => {
    logger.error(CONTEXT, "Stream error", error);
    const normalized = logAndNormalize(CONTEXT, error);
    setState((prev) => ({
      ...prev,
      isLoading: false,
      activeTools: [],
      error: normalized.message,
    }));
  }, []);

  const sendMessage = useCallback(
    (text: string) => {
      logger.info(CONTEXT, "sendMessage called", { text: text.slice(0, 80) });
      if (!text.trim()) {
        logger.warn(CONTEXT, "sendMessage called with empty text");
        return;
      }
      if (cleanupRef.current) {
        logger.info(
          CONTEXT,
          "Aborting previous stream before sending new message",
        );
        cleanupRef.current();
        cleanupRef.current = null;
      }
      const userMessage: ChatMessage = {
        id: uuidv4(),
        sender: "user",
        text: text.trim(),
        timestamp: new Date().toISOString(),
      };
      setState((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
        activeTools: [],
        messages: [...prev.messages, userMessage],
      }));
      streamingTextRef.current = "";
      streamingMessageIdRef.current = null;
      const cleanup = agentService.streamMessage(
        text.trim(),
        state.sessionId,
        handleSSEEvent,
        handleStreamError,
      );
      cleanupRef.current = cleanup;
      logger.info(CONTEXT, "SSE stream started");
    },
    [state.sessionId, handleSSEEvent, handleStreamError],
  );

  const handleSlotSelect = useCallback(
    (slot: AvailableSlot) => {
      logger.info(CONTEXT, "Slot selected by patient", { label: slot.label });
      const bookingMessage = `I'd like to book the ${slot.label} slot${
        slot.therapistName ? ` with ${slot.therapistName}` : ""
      }`;
      sendMessage(bookingMessage);
    },
    [sendMessage],
  );

  const resetChat = useCallback(() => {
    logger.info(CONTEXT, "resetChat called");
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    streamingTextRef.current = "";
    streamingMessageIdRef.current = null;
    lastTherapistRef.current = {};
    setState({
      sessionId: null,
      messages: [],
      isLoading: false,
      activeTools: [],
      error: null,
    });
  }, []);

  return { ...state, sendMessage, handleSlotSelect, resetChat };
}
