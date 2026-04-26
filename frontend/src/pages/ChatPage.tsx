// ============================================================
// ChatPage.tsx — Patient-facing chat interface
// Renders the full-screen ChatWindow with useAgentChat hook
// ============================================================

import React from "react";
import { ChatWindow } from "../components/chat/ChatWindow";
import { useAgentChat } from "../hooks/useAgentChat";
import { logger } from "../lib/logger";

const CONTEXT = "ChatPage";

const ChatPage: React.FC = () => {
  console.log("[ChatPage] render");
  logger.info(CONTEXT, "ChatPage mounted");

  const chat = useAgentChat();

  return (
    <div className="flex h-screen flex-col bg-gradient-to-br from-teal-50 via-white to-slate-100">
      {/* Top nav bar */}
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3 shadow-sm z-10">
        <div className="flex items-center gap-2">
          <span className="text-teal-600 font-bold text-lg tracking-tight">
            HealthSchedule
          </span>
          <span className="text-slate-300">|</span>
          <span className="text-slate-500 text-sm">Patient Portal</span>
        </div>
        <a
          href="/admin"
          className="text-xs text-slate-400 hover:text-teal-600 transition-colors"
        >
          Admin →
        </a>
      </header>

      {/* Chat area */}
      <main className="flex flex-1 overflow-hidden">
        {/* Sidebar — desktop only */}
        <aside className="hidden lg:flex flex-col w-72 border-r border-slate-200 bg-white p-6 gap-6">
          <div>
            <h2 className="text-sm font-semibold text-slate-700 mb-3">
              How it works
            </h2>
            <ol className="space-y-3 text-sm text-slate-500">
              {[
                "Tell us about your situation",
                "We match you with therapists",
                "Pick your preferred time",
                "Your appointment is booked",
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="flex-shrink-0 h-5 w-5 rounded-full bg-teal-100 text-teal-700 text-xs font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <h2 className="text-sm font-semibold text-slate-700 mb-2">
              Privacy
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Your information is kept confidential. We only use anonymized
              identifiers — no full names or contact details are stored in our
              system.
            </p>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <h2 className="text-sm font-semibold text-slate-700 mb-2">
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

        {/* Chat */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <ChatWindow chat={chat} />
        </div>
      </main>
    </div>
  );
};

export default ChatPage;
