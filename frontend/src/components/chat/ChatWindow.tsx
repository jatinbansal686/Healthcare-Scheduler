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
//   // Ref to the scrollable messages container — we scroll it directly
//   // instead of using scrollIntoView, which can escape the container
//   // and scroll the entire page.
//   const messagesContainerRef = useRef<HTMLDivElement>(null);
//   const inputRef = useRef<HTMLTextAreaElement>(null);

//   useEffect(() => {
//     if (chat.error) {
//       setError(chat.error);
//     }
//   }, [chat.error]);

//   // Scroll the messages container to bottom on new messages / tools.
//   // Using scrollTop instead of scrollIntoView to stay within the container.
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
//     /*
//      * LAYOUT CONTRACT:
//      *   - This component must be placed inside a container that has a fixed/
//      *     constrained height (e.g. h-screen, h-full with a sized ancestor).
//      *   - flex flex-col + overflow-hidden ensures the 3 children (header /
//      *     messages / input) fill exactly the parent height.
//      *   - The messages div is the ONLY scrollable region (overflow-y-auto).
//      *     min-h-0 is critical: without it flex children won't shrink below
//      *     their content size, causing the container to overflow the viewport.
//      */
//     <div className="flex flex-col h-full overflow-hidden bg-slate-50">
//       {/* ── Header ──────────────────────────────────────────── */}
//       <div className="flex-shrink-0 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 shadow-sm">
//         <div className="flex items-center gap-3">
//           <div className="h-9 w-9 rounded-full bg-teal-600 flex items-center justify-center text-white text-sm font-bold">
//             HC
//           </div>
//           <div>
//             <h2 className="font-semibold text-slate-800">
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
//           className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
//         >
//           New Chat
//         </button>
//       </div>

//       {/* ── Messages (ONLY this section scrolls) ────────────── */}
//       {/*
//        * min-h-0 is the critical fix for the scroll issue.
//        * flex-1 makes it fill available space, but without min-h-0
//        * a flex child's minimum height defaults to auto (its content size),
//        * so it grows beyond the container and pushes the page.
//        */}
//       <div
//         ref={messagesContainerRef}
//         className="flex-1 min-h-0 overflow-y-auto px-4 py-6 space-y-1"
//       >
//         {chat.messages.length === 0 && (
//           <div className="flex justify-start mb-3">
//             <div className="mr-2 flex-shrink-0 h-8 w-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 text-sm font-bold">
//               AI
//             </div>
//             <div className="max-w-[75%]">
//               <div className="rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm leading-relaxed bg-white border border-slate-200 text-slate-800 shadow-sm">
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
//             <div className="mr-2 flex-shrink-0 h-8 w-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 text-sm font-bold">
//               AI
//             </div>
//             <div className="rounded-2xl rounded-tl-sm px-4 py-3 bg-white border border-slate-200 shadow-sm">
//               <Spinner size="sm" label="Agent thinking…" />
//             </div>
//           </div>
//         )}
//       </div>

//       {/* ── Error banner (above input, doesn't push input off) ── */}
//       {error && (
//         <div className="flex-shrink-0 px-4 pb-2">
//           <ErrorBanner message={error} onDismiss={() => setError(null)} />
//         </div>
//       )}

//       {/* ── Input bar (always at bottom) ─────────────────────── */}
//       <div className="flex-shrink-0 border-t border-slate-200 bg-white px-4 py-4">
//         <div className="flex items-end gap-3">
//           <textarea
//             ref={inputRef}
//             value={inputText}
//             onChange={(e) => setInputText(e.target.value)}
//             onKeyDown={handleKeyDown}
//             placeholder="Describe what you're going through, your schedule, insurance…"
//             rows={2}
//             disabled={chat.isLoading}
//             className="flex-1 resize-none rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 focus:outline-none disabled:opacity-50 transition-colors"
//           />
//           <Button
//             onClick={handleSubmit}
//             disabled={!inputText.trim() || chat.isLoading}
//             isLoading={chat.isLoading}
//             size="lg"
//             className="flex-shrink-0"
//           >
//             Send
//           </Button>
//         </div>
//         <p className="mt-1.5 text-xs text-slate-400 text-center">
//           Press Enter to send · Shift+Enter for new line
//         </p>
//       </div>
//     </div>
//   );
// };

import React, { useRef, useEffect, useState } from "react";
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

  useEffect(() => {
    if (chat.error) {
      setError(chat.error);
    }
  }, [chat.error]);

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
    chat.sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-50">
      {/* ── Header ── */}
      <div className="flex-shrink-0 flex items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 py-3 sm:py-4 shadow-sm">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-teal-600 flex items-center justify-center text-white text-xs sm:text-sm font-bold">
            HC
          </div>
          <div>
            <h2 className="font-semibold text-slate-800 text-sm sm:text-base">
              Healthcare Scheduler
            </h2>
            <p className="text-xs text-teal-600 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-500 inline-block" />
              AI Agent Online
            </p>
          </div>
        </div>
        <button
          onClick={chat.resetChat}
          className="text-xs text-slate-400 hover:text-slate-600 transition-colors px-2 py-1"
        >
          New Chat
        </button>
      </div>

      {/* ── Messages ── */}
      <div
        ref={messagesContainerRef}
        className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-4 py-4 sm:py-6 space-y-1"
      >
        {chat.messages.length === 0 && (
          <div className="flex justify-start mb-3">
            <div className="mr-2 flex-shrink-0 h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 text-xs sm:text-sm font-bold">
              AI
            </div>
            <div className="max-w-[85%] sm:max-w-[75%]">
              <div className="rounded-2xl rounded-tl-sm px-3 sm:px-4 py-2.5 text-sm leading-relaxed bg-white border border-slate-200 text-slate-800 shadow-sm">
                {WELCOME_MESSAGE.split("\n").map((line, i) => (
                  <React.Fragment key={i}>
                    {line}
                    {i < WELCOME_MESSAGE.split("\n").length - 1 && <br />}
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

        {chat.activeTools.length > 0 && (
          <ToolProgressBar tools={chat.activeTools} />
        )}

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

      {/* ── Error banner ── */}
      {error && (
        <div className="flex-shrink-0 px-3 sm:px-4 pb-2">
          <ErrorBanner message={error} onDismiss={() => setError(null)} />
        </div>
      )}

      {/* ── Input bar ── */}
      <div className="flex-shrink-0 border-t border-slate-200 bg-white px-3 sm:px-4 py-3 sm:py-4">
        <div className="flex items-end gap-2 sm:gap-3">
          <textarea
            ref={inputRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your situation, schedule, insurance…"
            rows={2}
            disabled={chat.isLoading}
            className="flex-1 resize-none rounded-xl border border-slate-300 bg-slate-50 px-3 sm:px-4 py-2.5 sm:py-3 text-sm text-slate-800 placeholder-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 focus:outline-none disabled:opacity-50 transition-colors"
          />
          <Button
            onClick={handleSubmit}
            disabled={!inputText.trim() || chat.isLoading}
            isLoading={chat.isLoading}
            size="md"
            className="flex-shrink-0 sm:text-base sm:px-5 sm:py-3"
          >
            Send
          </Button>
        </div>
        <p className="mt-1.5 text-xs text-slate-400 text-center hidden sm:block">
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
};
