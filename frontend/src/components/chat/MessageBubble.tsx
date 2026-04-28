import React from "react";
import type { ChatMessage, AvailableSlot } from "../../types/agent.types";
import { SlotCards } from "./SlotCards";
import {
  stripSlotLines,
  stripTherapistLines,
  parseTherapists,
  isTherapistListingMessage,
  type ParsedTherapist,
} from "../../lib/slotParser";

interface MessageBubbleProps {
  message: ChatMessage;
  onSlotSelect?: (slot: AvailableSlot) => void;
  onTherapistSelect?: (name: string) => void;
  isLoading?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────

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

/**
 * Renders text with **bold** markdown → <strong> tags.
 * Handles newlines. Works for all AI providers.
 */
function renderMarkdown(text: string) {
  return text.split("\n").map((line, i, arr) => (
    <React.Fragment key={i}>
      {renderBoldInline(line)}
      {i < arr.length - 1 && <br />}
    </React.Fragment>
  ));
}

function renderBoldInline(line: string): React.ReactNode {
  // Split on **...** markers
  const parts = line.split(/(\*{1,2}[^*]+\*{1,2})/g);
  if (parts.length === 1) return line;
  return parts.map((part, i) => {
    const boldMatch = part.match(/^\*{1,2}([^*]+)\*{1,2}$/);
    if (boldMatch) return <strong key={i}>{boldMatch[1]}</strong>;
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

// ── Therapist Card UI ─────────────────────────────────────────

function TherapistCard({
  therapist,
  onSelect,
  disabled,
}: {
  therapist: ParsedTherapist;
  onSelect: (name: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-teal-50 hover:border-teal-300 transition-colors">
      <div className="flex flex-col gap-0.5 flex-1 min-w-0 mr-3">
        <span className="text-sm font-semibold text-slate-800 truncate">
          {therapist.name}
        </span>
        {therapist.yearsExperience > 0 && (
          <span className="text-xs text-slate-400">
            {therapist.yearsExperience} yrs experience
          </span>
        )}
        {therapist.specialties.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {therapist.specialties.slice(0, 3).map((s) => (
              <span
                key={s}
                className="inline-block rounded-full px-2 py-0.5 text-xs bg-teal-100 text-teal-700"
              >
                {s}
              </span>
            ))}
          </div>
        )}
      </div>
      <button
        onClick={() => onSelect(therapist.name)}
        disabled={disabled}
        className="flex-shrink-0 px-3 py-1.5 text-xs bg-teal-600 text-white rounded-md hover:bg-teal-700 disabled:opacity-40 transition-colors"
      >
        Select
      </button>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  onSlotSelect,
  onTherapistSelect,
  isLoading = false,
}) => {
  const isUser = message.sender === "user";

  const hasSlots = !isUser && !!message.slots && message.slots.length > 0;

  const therapists: ParsedTherapist[] = !isUser
    ? parseTherapists(message.text)
    : [];
  const hasTherapists = therapists.length >= 2;

  let displayText = message.text;
  if (hasSlots) displayText = stripSlotLines(displayText);
  if (hasTherapists) displayText = stripTherapistLines(displayText);

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
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
          {/* Text with markdown bold rendering */}
          {displayText && renderMarkdown(displayText)}

          {/* Therapist cards */}
          {hasTherapists && (
            <div className="mt-3 flex flex-col gap-2">
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-1">
                Matching Therapists — tap to select
              </p>
              {therapists.map((t) => (
                <TherapistCard
                  key={t.name}
                  therapist={t}
                  onSelect={onTherapistSelect ?? (() => {})}
                  disabled={isLoading}
                />
              ))}
            </div>
          )}

          {/* Slot cards (existing logic unchanged) */}
          {hasSlots && onSlotSelect && (
            <SlotCards
              slots={message.slots!}
              onSelect={onSlotSelect}
              disabled={isLoading}
            />
          )}
        </div>

        <span className="text-xs text-slate-400 px-1">
          {formatTime(message.timestamp)}
        </span>
      </div>

      {isUser && (
        <div className="ml-2 flex-shrink-0 h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 text-sm font-bold">
          You
        </div>
      )}
    </div>
  );
};
