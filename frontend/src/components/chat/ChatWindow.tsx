// import React, { useRef, useEffect, useState } from "react";
// import { MessageBubble } from "./MessageBubble";
// import { ToolProgressBar } from "./ToolProgressBar";
// import { Spinner } from "../ui/ Spinner";
// import { ErrorBanner } from "../ui/ ErrorBanner";
// import { Button } from "../ui/Button";
// import type { UseAgentChatReturn } from "../../hooks/useAgentChat";
// import { logger } from "../../lib/logger";

// const CONTEXT = "ChatWindow";

// interface ChatWindowProps {
//   chat: UseAgentChatReturn;
// }

// const WELCOME_MESSAGE =
//   "Hello! I'm your healthcare scheduling assistant. I can help you find the right therapist based on your needs, schedule, and insurance.\n\nTell me a bit about what you're going through, and we'll find someone great for you.";

// export const ChatWindow: React.FC<ChatWindowProps> = ({ chat }) => {
//   console.log("[ChatWindow] render", {
//     messageCount: chat.messages.length,
//     isLoading: chat.isLoading,
//     activeTools: chat.activeTools.length,
//   });

//   const [inputText, setInputText] = useState("");
//   const [error, setError] = useState<string | null>(null);
//   const messagesContainerRef = useRef<HTMLDivElement>(null);
//   const inputRef = useRef<HTMLTextAreaElement>(null);

//   useEffect(() => {
//     if (chat.error) {
//       setError(chat.error);
//     }
//   }, [chat.error]);

//   useEffect(() => {
//     logger.debug(CONTEXT, "Auto-scrolling to bottom");
//     const el = messagesContainerRef.current;
//     if (el) {
//       el.scrollTop = el.scrollHeight;
//     }
//   }, [chat.messages, chat.activeTools, chat.isLoading]);

//   const handleSubmit = () => {
//     const text = inputText.trim();
//     logger.info(CONTEXT, "handleSubmit called", { textLength: text.length });

//     if (!text || chat.isLoading) {
//       logger.warn(CONTEXT, "Submit blocked — empty or loading");
//       return;
//     }

//     setInputText("");
//     setError(null);
//     chat.sendMessage(text);
//   };

//   const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
//     if (e.key === "Enter" && !e.shiftKey) {
//       e.preventDefault();
//       handleSubmit();
//     }
//   };

//   return (
//     <div className="flex flex-col h-full overflow-hidden bg-slate-50">
//       {/* ── Header ── */}
//       <div className="flex-shrink-0 flex items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 py-3 sm:py-4 shadow-sm">
//         <div className="flex items-center gap-2 sm:gap-3">
//           <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-teal-600 flex items-center justify-center text-white text-xs sm:text-sm font-bold">
//             HC
//           </div>
//           <div>
//             <h2 className="font-semibold text-slate-800 text-sm sm:text-base">
//               Healthcare Scheduler
//             </h2>
//             <p className="text-xs text-teal-600 flex items-center gap-1">
//               <span className="h-1.5 w-1.5 rounded-full bg-teal-500 inline-block" />
//               AI Agent Online
//             </p>
//           </div>
//         </div>
//         <button
//           onClick={chat.resetChat}
//           className="text-xs text-slate-400 hover:text-slate-600 transition-colors px-2 py-1"
//         >
//           New Chat
//         </button>
//       </div>

//       {/* ── Messages ── */}
//       <div
//         ref={messagesContainerRef}
//         className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-4 py-4 sm:py-6 space-y-1"
//       >
//         {chat.messages.length === 0 && (
//           <div className="flex justify-start mb-3">
//             <div className="mr-2 flex-shrink-0 h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 text-xs sm:text-sm font-bold">
//               AI
//             </div>
//             <div className="max-w-[85%] sm:max-w-[75%]">
//               <div className="rounded-2xl rounded-tl-sm px-3 sm:px-4 py-2.5 text-sm leading-relaxed bg-white border border-slate-200 text-slate-800 shadow-sm">
//                 {WELCOME_MESSAGE.split("\n").map((line, i) => (
//                   <React.Fragment key={i}>
//                     {line}
//                     {i < WELCOME_MESSAGE.split("\n").length - 1 && <br />}
//                   </React.Fragment>
//                 ))}
//               </div>
//             </div>
//           </div>
//         )}

//         {chat.messages.map((msg) => (
//           <MessageBubble
//             key={msg.id}
//             message={msg}
//             onSlotSelect={chat.handleSlotSelect}
//             onTherapistSelect={(name) =>
//               chat.sendMessage(`I'd like to book with ${name}`)
//             }
//             isLoading={chat.isLoading}
//           />
//         ))}

//         {chat.activeTools.length > 0 && (
//           <ToolProgressBar tools={chat.activeTools} />
//         )}

//         {chat.isLoading && chat.activeTools.length === 0 && (
//           <div className="flex justify-start mb-3">
//             <div className="mr-2 flex-shrink-0 h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 text-xs sm:text-sm font-bold">
//               AI
//             </div>
//             <div className="rounded-2xl rounded-tl-sm px-4 py-3 bg-white border border-slate-200 shadow-sm">
//               <Spinner size="sm" label="Agent thinking…" />
//             </div>
//           </div>
//         )}
//       </div>

//       {/* ── Error banner ── */}
//       {error && (
//         <div className="flex-shrink-0 px-3 sm:px-4 pb-2">
//           <ErrorBanner message={error} onDismiss={() => setError(null)} />
//         </div>
//       )}

//       {/* ── Input bar ── */}
//       <div className="flex-shrink-0 border-t border-slate-200 bg-white px-3 sm:px-4 py-3 sm:py-4">
//         <div className="flex items-end gap-2 sm:gap-3">
//           <textarea
//             ref={inputRef}
//             value={inputText}
//             onChange={(e) => setInputText(e.target.value)}
//             onKeyDown={handleKeyDown}
//             placeholder="Describe your situation, schedule, insurance…"
//             rows={2}
//             disabled={chat.isLoading}
//             className="flex-1 resize-none rounded-xl border border-slate-300 bg-slate-50 px-3 sm:px-4 py-2.5 sm:py-3 text-sm text-slate-800 placeholder-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 focus:outline-none disabled:opacity-50 transition-colors"
//           />
//           <Button
//             onClick={handleSubmit}
//             disabled={!inputText.trim() || chat.isLoading}
//             isLoading={chat.isLoading}
//             size="md"
//             className="flex-shrink-0 sm:text-base sm:px-5 sm:py-3"
//           >
//             Send
//           </Button>
//         </div>
//         <p className="mt-1.5 text-xs text-slate-400 text-center hidden sm:block">
//           Press Enter to send · Shift+Enter for new line
//         </p>
//       </div>
//     </div>
//   );
// };

import React, { useRef, useEffect, useState, useCallback } from "react";
import { MessageBubble } from "./MessageBubble";
import { ToolProgressBar } from "./ToolProgressBar";
import { Spinner } from "../ui/ Spinner";
import { ErrorBanner } from "../ui/ ErrorBanner";
import { Button } from "../ui/Button";
import type { UseAgentChatReturn } from "../../hooks/useAgentChat";
import { logger } from "../../lib/logger";

const CONTEXT = "ChatWindow";

interface ChatWindowProps {
  chat: UseAgentChatReturn;
}

const WELCOME_MESSAGE =
  "Hello! I'm your healthcare scheduling assistant. I can help you find the right therapist based on your needs, schedule, and insurance.\n\nTell me a bit about what you're going through, and we'll find someone great for you.";

export const ChatWindow: React.FC<ChatWindowProps> = ({ chat }) => {
  console.log("[ChatWindow] render", {
    messageCount: chat.messages.length,
    isLoading: chat.isLoading,
    activeTools: chat.activeTools.length,
  });

  const [inputText, setInputText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ── Auto-resize textarea ──────────────────────────────────────
  const autoResize = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    // Cap at 120px (~5 lines) so it doesn't swallow the screen on mobile
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, []);

  useEffect(() => {
    if (chat.error) {
      setError(chat.error);
    }
  }, [chat.error]);

  // ── Scroll to bottom on new messages / tools ─────────────────
  useEffect(() => {
    logger.debug(CONTEXT, "Auto-scrolling to bottom");
    const el = messagesContainerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [chat.messages, chat.activeTools, chat.isLoading]);

  const handleSubmit = () => {
    const text = inputText.trim();
    logger.info(CONTEXT, "handleSubmit called", { textLength: text.length });

    if (!text || chat.isLoading) {
      logger.warn(CONTEXT, "Submit blocked — empty or loading");
      return;
    }

    setInputText("");
    setError(null);
    // Reset textarea height after clearing
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }
    chat.sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    autoResize();
  };

  return (
    // h-full inherits from parent flex container in ChatPage
    <div className="flex flex-col h-full overflow-hidden bg-slate-50">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 py-3 shadow-sm">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="h-8 w-8 sm:h-9 sm:w-9 flex-shrink-0 rounded-full bg-teal-600 flex items-center justify-center text-white text-xs sm:text-sm font-bold">
            HC
          </div>
          <div className="min-w-0">
            <h2 className="font-semibold text-slate-800 text-sm sm:text-base truncate">
              Healthcare Scheduler
            </h2>
            <p className="text-xs text-teal-600 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-500 inline-block flex-shrink-0" />
              AI Agent Online
            </p>
          </div>
        </div>
        <button
          onClick={chat.resetChat}
          className="flex-shrink-0 ml-3 text-xs text-slate-400 hover:text-slate-600 transition-colors px-2 py-1.5 rounded-md hover:bg-slate-100 active:bg-slate-200"
        >
          New Chat
        </button>
      </div>

      {/* ── Messages area ────────────────────────────────────── */}
      <div
        ref={messagesContainerRef}
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-4 md:px-6 py-4 sm:py-5 space-y-1"
      >
        {/* Welcome message — only when no messages yet */}
        {chat.messages.length === 0 && (
          <div className="flex justify-start mb-3">
            <div className="mr-2 flex-shrink-0 h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 text-xs sm:text-sm font-bold">
              AI
            </div>
            <div className="max-w-[85%] sm:max-w-[78%] md:max-w-[70%]">
              <div className="rounded-2xl rounded-tl-sm px-3 sm:px-4 py-2.5 text-sm leading-relaxed bg-white border border-slate-200 text-slate-800 shadow-sm break-words">
                {WELCOME_MESSAGE.split("\n").map((line, i, arr) => (
                  <React.Fragment key={i}>
                    {line}
                    {i < arr.length - 1 && <br />}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        )}

        {chat.messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            onSlotSelect={chat.handleSlotSelect}
            onTherapistSelect={(name) =>
              chat.sendMessage(`I'd like to book with ${name}`)
            }
            isLoading={chat.isLoading}
          />
        ))}

        {/* Tool progress — shown while agent is using tools */}
        {chat.activeTools.length > 0 && (
          <ToolProgressBar tools={chat.activeTools} />
        )}

        {/* Generic thinking spinner — shown when loading but no tools yet */}
        {chat.isLoading && chat.activeTools.length === 0 && (
          <div className="flex justify-start mb-3">
            <div className="mr-2 flex-shrink-0 h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 text-xs sm:text-sm font-bold">
              AI
            </div>
            <div className="rounded-2xl rounded-tl-sm px-4 py-3 bg-white border border-slate-200 shadow-sm">
              <Spinner size="sm" label="Agent thinking…" />
            </div>
          </div>
        )}
      </div>

      {/* ── Error banner ─────────────────────────────────────── */}
      {error && (
        <div className="flex-shrink-0 px-3 sm:px-4 pb-2">
          <ErrorBanner message={error} onDismiss={() => setError(null)} />
        </div>
      )}

      {/* ── Input bar ────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-t border-slate-200 bg-white px-3 sm:px-4 md:px-6 py-3 sm:py-4">
        <div className="flex items-end gap-2 sm:gap-3">
          <textarea
            ref={inputRef}
            value={inputText}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Describe your situation, schedule, insurance…"
            rows={1}
            disabled={chat.isLoading}
            className="
              flex-1 min-w-0 resize-none overflow-hidden
              rounded-xl border border-slate-300 bg-slate-50
              px-3 sm:px-4 py-2.5
              text-sm text-slate-800 placeholder-slate-400
              focus:border-teal-500 focus:ring-2 focus:ring-teal-200 focus:outline-none
              disabled:opacity-50 transition-colors
              leading-relaxed
            "
            style={{ minHeight: "42px" }}
          />
          <Button
            onClick={handleSubmit}
            disabled={!inputText.trim() || chat.isLoading}
            isLoading={chat.isLoading}
            size="md"
            className="flex-shrink-0 py-2.5 px-4 sm:px-5 text-sm sm:text-base"
          >
            Send
          </Button>
        </div>
        {/* Hint — hidden on mobile to save space */}
        <p className="mt-1.5 text-xs text-slate-400 text-center hidden sm:block">
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
};
