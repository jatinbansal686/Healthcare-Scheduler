
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

const SendIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-5 w-5"
    viewBox="0 0 24 24"
    fill="currentColor"
  >
    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
  </svg>
);

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

  const autoResize = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, []);

  useEffect(() => {
    if (chat.error) setError(chat.error);
  }, [chat.error]);

  useEffect(() => {
    logger.debug(CONTEXT, "Auto-scrolling to bottom");
    const el = messagesContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat.messages, chat.activeTools, chat.isLoading]);

  // Scroll to bottom when keyboard opens (visualViewport resize)
  useEffect(() => {
    const scrollToBottom = () => {
      const el = messagesContainerRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    };
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", scrollToBottom);
      return () =>
        window.visualViewport!.removeEventListener("resize", scrollToBottom);
    }
  }, []);

  const handleSubmit = () => {
    const text = inputText.trim();
    logger.info(CONTEXT, "handleSubmit called", { textLength: text.length });
    if (!text || chat.isLoading) {
      logger.warn(CONTEXT, "Submit blocked — empty or loading");
      return;
    }
    setInputText("");
    setError(null);
    if (inputRef.current) inputRef.current.style.height = "auto";
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
    // h-full fills the flex column from ChatPage
    // overflow-hidden on both axes — no scrollbars on the container itself
    <div className="flex flex-col h-full w-full overflow-hidden bg-slate-50">
      {/* ── Header ── */}
      <div className="flex-shrink-0 flex items-center justify-between border-b border-slate-200 bg-white px-3 sm:px-6 py-2 sm:py-4 shadow-sm">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-6 w-6 sm:h-9 sm:w-9 flex-shrink-0 rounded-full bg-teal-600 flex items-center justify-center text-white text-[9px] sm:text-sm font-bold">
            HC
          </div>
          <div className="min-w-0">
            <h2 className="font-semibold text-slate-800 text-xs sm:text-base leading-tight truncate">
              Healthcare Scheduler
            </h2>
            <p className="text-[10px] sm:text-xs text-teal-600 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-500 inline-block flex-shrink-0" />
              AI Agent Online
            </p>
          </div>
        </div>
        <button
          onClick={chat.resetChat}
          className="flex-shrink-0 ml-2 text-xs text-slate-400 hover:text-slate-600 transition-colors px-2 py-1 rounded-md hover:bg-slate-100"
        >
          New Chat
        </button>
      </div>

      {/* ── Messages ── */}
      {/* Only this div scrolls vertically. overflow-x-hidden prevents horiz scroll. */}
      <div
        ref={messagesContainerRef}
        className="flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden overscroll-contain px-2 sm:px-4 md:px-6 py-4 space-y-1"
      >
        {chat.messages.length === 0 && (
          <div className="flex justify-start mb-3">
            <div className="mr-1.5 flex-shrink-0 h-6 w-6 sm:h-8 sm:w-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 text-[9px] sm:text-sm font-bold self-start">
              AI
            </div>
            {/* max-w-[calc(100%-2rem)] ensures bubble never touches right edge */}
            <div className="min-w-0 max-w-[calc(100%-2rem)] sm:max-w-[78%]">
              <div className="rounded-2xl rounded-tl-sm px-3 sm:px-4 py-2.5 text-sm leading-relaxed bg-white border border-slate-200 text-slate-800 shadow-sm break-words overflow-hidden">
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

        {chat.activeTools.length > 0 && (
          <ToolProgressBar tools={chat.activeTools} />
        )}

        {chat.isLoading && chat.activeTools.length === 0 && (
          <div className="flex justify-start mb-3">
            <div className="mr-1.5 flex-shrink-0 h-6 w-6 sm:h-8 sm:w-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 text-[9px] sm:text-sm font-bold self-start">
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
      <div className="flex-shrink-0 border-t border-slate-200 bg-white px-2 sm:px-4 md:px-6 py-2.5 sm:py-4">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={inputText}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Describe your situation, schedule, insurance…"
            rows={1}
            disabled={chat.isLoading}
            className="flex-1 min-w-0 resize-none overflow-hidden rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 focus:outline-none disabled:opacity-50 transition-colors leading-relaxed"
            style={{ minHeight: "42px" }}
          />

          {/* Mobile: icon-only button */}
          <button
            onClick={handleSubmit}
            disabled={!inputText.trim() || chat.isLoading}
            aria-label="Send message"
            className="sm:hidden flex-shrink-0 h-[42px] w-[42px] rounded-xl bg-teal-600 text-white flex items-center justify-center hover:bg-teal-700 active:bg-teal-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-teal-400"
          >
            <SendIcon />
          </button>

          {/* Desktop: text button */}
          <div className="hidden sm:block flex-shrink-0">
            <Button
              onClick={handleSubmit}
              disabled={!inputText.trim() || chat.isLoading}
              isLoading={chat.isLoading}
              size="md"
              className="px-5 py-2.5"
            >
              Send
            </Button>
          </div>
        </div>
        <p className="mt-1.5 text-xs text-slate-400 text-center hidden sm:block">
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
};
