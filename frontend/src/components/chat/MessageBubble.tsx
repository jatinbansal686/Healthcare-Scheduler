import React from "react";
import type { ChatMessage, AvailableSlot } from "../../types/agent.types";
import { SlotCards } from "./SlotCards";
import { stripSlotLines } from "../../lib/slotParser";

interface MessageBubbleProps {
  message: ChatMessage;
  onSlotSelect?: (slot: AvailableSlot) => void;
  onTherapistSelect?: (name: string) => void; // ✅ added
  isLoading?: boolean;
}

// ─────────────────────────────────────────────────────────────
// Helpers (UNCHANGED)
// ─────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function renderText(text: string) {
  return text.split("\n").map((line, i, arr) => (
    <React.Fragment key={i}>
      {line}
      {i < arr.length - 1 && <br />}
    </React.Fragment>
  ));
}

// ─────────────────────────────────────────────────────────────
// Therapist Parsing (NEW - SAFE ADDITION)
// ─────────────────────────────────────────────────────────────

function parseTherapistList(text: string) {
  const lines = text.split("\n").filter((l) => l.trim());
  const therapists: { name: string; details: string }[] = [];

  for (const line of lines) {
    const match = line.match(/^\*\s+\*\*([^*]+)\*\*[:\s—–-]+(.*)/);
    if (match) {
      therapists.push({
        name: match[1].trim(),
        details: match[2].trim(),
      });
    }
  }

  // Only treat as therapist list if multiple entries
  return therapists.length >= 2 ? therapists : [];
}

// ─────────────────────────────────────────────────────────────
// Therapist Card (NEW UI)
// ─────────────────────────────────────────────────────────────

function TherapistCard({
  therapist,
  onSelect,
  disabled,
}: {
  therapist: { name: string; details: string };
  onSelect: (name: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-teal-50 hover:border-teal-300 transition-colors">
      <div className="flex flex-col">
        <span className="text-sm font-semibold text-slate-800">
          {therapist.name}
        </span>
        <span className="text-xs text-slate-500">
          {therapist.details}
        </span>
      </div>

      <button
        onClick={() => onSelect(therapist.name)}
        disabled={disabled}
        className="px-3 py-1 text-xs bg-teal-600 text-white rounded-md hover:bg-teal-700 disabled:opacity-40"
      >
        Select
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  onSlotSelect,
  onTherapistSelect,
  isLoading = false,
}) => {
  console.log("[MessageBubble] render", {
    id: message.id,
    sender: message.sender,
    hasSlots: !!message.slots?.length,
    slotCount: message.slots?.length ?? 0,
  });

  const isUser = message.sender === "user";

  const hasSlots = !isUser && !!message.slots && message.slots.length > 0;

  // ✅ NEW: therapist detection
  const therapists = !isUser ? parseTherapistList(message.text) : [];
  const hasTherapists = therapists.length > 0;

  // Existing logic preserved
  const displayText = hasSlots ? stripSlotLines(message.text) : message.text;

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      {/* Agent avatar */}
      {!isUser && (
        <div className="mr-2 flex-shrink-0 h-8 w-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 text-sm font-bold">
          AI
        </div>
      )}

      <div
        className={`${
          hasSlots || hasTherapists
            ? "max-w-[90%] sm:max-w-[85%]"
            : "max-w-[75%]"
        } ${isUser ? "items-end" : "items-start"} flex flex-col gap-1`}
      >
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed w-full ${
            isUser
              ? "bg-teal-600 text-white rounded-tr-sm"
              : "bg-white border border-slate-200 text-slate-800 rounded-tl-sm shadow-sm"
          }`}
        >
          {/* ───────────────────────────────────────────── */}
          {/* Therapist Cards (NEW, NON-BREAKING) */}
          {/* ───────────────────────────────────────────── */}
          {hasTherapists ? (
            <div className="space-y-2">
              {therapists.map((t) => (
                <TherapistCard
                  key={t.name}
                  therapist={t}
                  onSelect={onTherapistSelect ?? (() => {})}
                  disabled={isLoading}
                />
              ))}
            </div>
          ) : (
            <>
              {/* Existing text rendering */}
              {displayText && renderText(displayText)}

              {/* EXISTING SLOT LOGIC (UNCHANGED) */}
              {hasSlots && onSlotSelect && (
                <SlotCards
                  slots={message.slots!}
                  onSelect={onSlotSelect}
                  disabled={isLoading}
                />
              )}
            </>
          )}
        </div>

        <span className="text-xs text-slate-400 px-1">
          {formatTime(message.timestamp)}
        </span>
      </div>

      {/* User avatar */}
      {isUser && (
        <div className="ml-2 flex-shrink-0 h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 text-sm font-bold">
          You
        </div>
      )}
    </div>
  );
};

