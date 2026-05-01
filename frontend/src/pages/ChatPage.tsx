import React, { useEffect, useRef } from "react";
import { ChatWindow } from "../components/chat/ChatWindow";
import { useAgentChat } from "../hooks/useAgentChat";
import { logger } from "../lib/logger";

const CONTEXT = "ChatPage";

/**
 * useViewportHeight
 * Sets a CSS variable --vh to 1% of the *visual* viewport height.
 * On mobile, this shrinks correctly when the keyboard opens.
 * Usage in CSS: height: calc(var(--vh, 1vh) * 100)
 */
function useViewportHeight() {
  useEffect(() => {
    const set = () => {
      // visualViewport is the portion of the screen not covered by the keyboard
      const h = window.visualViewport
        ? window.visualViewport.height
        : window.innerHeight;
      document.documentElement.style.setProperty("--vh", `${h * 0.01}px`);
    };

    set(); // run once on mount

    // visualViewport fires 'resize' when keyboard opens/closes
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", set);
      window.visualViewport.addEventListener("scroll", set);
    } else {
      window.addEventListener("resize", set);
    }

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", set);
        window.visualViewport.removeEventListener("scroll", set);
      } else {
        window.removeEventListener("resize", set);
      }
    };
  }, []);
}

const ChatPage: React.FC = () => {
  console.log("[ChatPage] render");
  logger.info(CONTEXT, "ChatPage mounted");

  useViewportHeight();
  const chat = useAgentChat();

  return (
    // Use --vh CSS variable instead of 100dvh — works correctly on iOS Safari
    // when the virtual keyboard opens
    <div
      className="flex flex-col overflow-hidden bg-gradient-to-br from-teal-50 via-white to-slate-100"
      style={{ height: "calc(var(--vh, 1vh) * 100)" }}
    >
      {/* ── Top nav bar ── */}
      <header className="flex-shrink-0 flex items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 py-3 shadow-sm z-10">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-teal-600 font-bold text-base sm:text-lg tracking-tight whitespace-nowrap">
            HealthSchedule
          </span>
          <span className="text-slate-300 hidden sm:inline">|</span>
          <span className="text-slate-500 text-xs sm:text-sm hidden sm:inline truncate">
            Patient Portal
          </span>
        </div>
        <a
          href="/admin"
          className="text-xs text-slate-400 hover:text-teal-600 transition-colors whitespace-nowrap ml-4 flex-shrink-0"
        >
          Admin →
        </a>
      </header>

      {/* ── Main body ── */}
      <main className="flex flex-1 overflow-hidden min-h-0">
        {/* ── Sidebar — desktop only (lg+) ── */}
        <aside className="hidden lg:flex flex-col w-64 xl:w-72 flex-shrink-0 border-r border-slate-200 bg-white p-5 xl:p-6 gap-5 overflow-y-auto">
          <div>
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              How it works
            </h2>
            <ol className="space-y-3">
              {[
                "Tell us about your situation",
                "We match you with therapists",
                "Pick your preferred time",
                "Your appointment is booked",
              ].map((step, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2.5 text-sm text-slate-600"
                >
                  <span className="flex-shrink-0 h-5 w-5 rounded-full bg-teal-100 text-teal-700 text-xs font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <span className="leading-snug">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Privacy
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Your information is kept confidential. We only use anonymized
              identifiers — no full names or contact details are stored in our
              system.
            </p>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Insurance we support
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {[
                "Aetna",
                "BlueCross",
                "UnitedHealth",
                "Cigna",
                "Humana",
                "Medicare",
              ].map((ins) => (
                <span
                  key={ins}
                  className="text-xs bg-slate-100 text-slate-500 rounded-full px-2 py-0.5"
                >
                  {ins}
                </span>
              ))}
            </div>
          </div>
        </aside>

        {/* ── Chat column ── */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0 min-w-0">
          <ChatWindow chat={chat} />
        </div>
      </main>
    </div>
  );
};

export default ChatPage;
