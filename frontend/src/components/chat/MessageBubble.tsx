// ============================================================
// MessageBubble.tsx — final merged version
// ============================================================

import React from "react";
import type {
  ChatMessage,
  AvailableSlot,
  TherapistOption,
} from "../../types/agent.types";
import { SlotCards } from "./SlotCards";
import {
  stripSlotLines,
  stripTherapistLines,
  parseTherapists,
  type ParsedTherapist,
} from "../../lib/slotParser";

interface MessageBubbleProps {
  message: ChatMessage;
  onSlotSelect?: (slot: AvailableSlot) => void;
  onTherapistSelect?: (name: string) => void;
  isLoading?: boolean;
}

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

function normalizeText(text: string): string {
  return text
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "  ")
    .replace(/\n{3,}/g, "\n\n");
}

function isEmailOrUrl(text: string): boolean {
  return /^(https?:\/\/|www\.|[\w.+-]+@[\w-]+\.)/.test(text.trim());
}

function renderMarkdown(text: string) {
  const normalized = normalizeText(text);
  return normalized.split("\n").map((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) return <div key={i} className="h-1.5" />;
    const bulletMatch = trimmed.match(/^([•\-*]|\d+\.)\s+(.+)$/);
    if (bulletMatch) {
      return (
        <div key={i} className="flex gap-1.5 my-0.5">
          <span className="text-slate-400 flex-shrink-0 mt-0.5">•</span>
          <span className="min-w-0 break-words overflow-hidden">
            {renderBoldInline(bulletMatch[2])}
          </span>
        </div>
      );
    }
    if (isEmailOrUrl(trimmed)) {
      return (
        <div
          key={i}
          className={`break-all overflow-hidden ${i > 0 ? "mt-0.5" : ""}`}
        >
          {renderBoldInline(trimmed)}
        </div>
      );
    }
    return (
      <div
        key={i}
        className={`break-words overflow-hidden ${i > 0 ? "mt-0.5" : ""}`}
      >
        {renderBoldInline(trimmed)}
      </div>
    );
  });
}

function renderBoldInline(line: string): React.ReactNode {
  const parts = line.split(/(\*{1,2}[^*]+\*{1,2})/g);
  if (parts.length === 1) return line;
  return parts.map((part, i) => {
    const boldMatch = part.match(/^\*{1,2}([^*]+)\*{1,2}$/);
    if (boldMatch) return <strong key={i}>{boldMatch[1]}</strong>;
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

interface TherapistCardProps {
  therapist: TherapistOption | ParsedTherapist;
  onSelect: (name: string) => void;
  disabled: boolean;
}

function TherapistCard({ therapist, onSelect, disabled }: TherapistCardProps) {
  return (
    <div className="flex items-start justify-between gap-2 p-2.5 sm:p-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-teal-50 hover:border-teal-300 transition-colors">
      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
        <span className="text-sm font-semibold text-slate-800 break-words leading-snug">
          {therapist.name}
        </span>
        {(therapist.yearsExperience ?? 0) > 0 && (
          <span className="text-xs text-slate-400">
            {therapist.yearsExperience} yrs experience
          </span>
        )}
        {(therapist.specialties ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {(therapist.specialties ?? []).slice(0, 3).map((s) => (
              <span
                key={s}
                className="inline-block rounded-full px-2 py-0.5 text-xs bg-teal-100 text-teal-700 whitespace-nowrap"
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
        className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 text-xs bg-teal-600 text-white rounded-md hover:bg-teal-700 disabled:opacity-40 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-400"
      >
        Select
      </button>
    </div>
  );
}

interface ConfirmationCardProps {
  therapistName: string;
  date: string;
  time: string;
  meetLink?: string;
  appointmentId?: string;
}

function ConfirmationCard({
  therapistName,
  date,
  time,
  meetLink,
}: ConfirmationCardProps) {
  return (
    <div className="mt-3 rounded-xl border border-teal-200 bg-teal-50 p-3 sm:p-4 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-teal-600 text-lg">✓</span>
        <span className="text-sm font-semibold text-teal-800">
          Appointment Confirmed
        </span>
      </div>
      <div className="text-sm text-slate-700 space-y-1">
        <div>
          <span className="font-medium">Therapist:</span>{" "}
          <span className="break-words">{therapistName}</span>
        </div>
        <div>
          <span className="font-medium">Date:</span> {date}
        </div>
        <div>
          <span className="font-medium">Time:</span> {time}
        </div>
        {meetLink && (
          <a
            href={meetLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-1 text-xs text-teal-600 underline hover:text-teal-800 break-all"
          >
            Join Google Meet
          </a>
        )}
      </div>
    </div>
  );
}

function OutOfScopeBadge() {
  return (
    <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
      <span>ℹ️</span>
      <span>Outside scheduling scope</span>
    </div>
  );
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  onSlotSelect,
  onTherapistSelect,
  isLoading = false,
}) => {
  const isUser = message.sender === "user";
  const sd = message.structuredData;

  const hasStructuredTherapists =
    !isUser && sd?.ui_hint === "therapists" && (sd.therapists?.length ?? 0) > 0;
  const hasStructuredSlots =
    !isUser && sd?.ui_hint === "slots" && (sd.slots?.length ?? 0) > 0;
  const hasConfirmation =
    !isUser && sd?.ui_hint === "confirmation" && !!sd.confirmation;
  const isOutOfScope = !isUser && sd?.ui_hint === "out_of_scope";

  const legacySlots = !isUser && !sd ? (message.slots ?? []) : [];
  const hasLegacySlots = legacySlots.length > 0;
  const legacyTherapists: ParsedTherapist[] =
    !isUser && !sd ? parseTherapists(message.text) : [];
  const hasLegacyTherapists = legacyTherapists.length >= 1;

  let displayText = message.text;
  if (hasLegacySlots) displayText = stripSlotLines(displayText);
  if (hasLegacyTherapists) displayText = stripTherapistLines(displayText);

  const hasExtras =
    hasStructuredTherapists ||
    hasStructuredSlots ||
    hasConfirmation ||
    isOutOfScope ||
    hasLegacySlots ||
    hasLegacyTherapists;

  return (
    <div
      className={`flex w-full min-w-0 ${isUser ? "justify-end" : "justify-start"} mb-3`}
    >
      {!isUser && (
        <div className="mr-1.5 sm:mr-2 flex-shrink-0 h-6 w-6 sm:h-8 sm:w-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 text-[9px] sm:text-xs font-bold self-start mt-0.5">
          AI
        </div>
      )}

      <div
        className={`flex flex-col gap-1 min-w-0 overflow-hidden ${isUser ? "items-end" : "items-start"} ${hasExtras ? "max-w-[92%] sm:max-w-[88%] md:max-w-[82%]" : "max-w-[80%] sm:max-w-[75%] md:max-w-[68%]"}`}
      >
        <div
          className={`w-full rounded-2xl px-3 sm:px-4 py-2 sm:py-2.5 text-sm leading-relaxed overflow-hidden ${isUser ? "bg-teal-600 text-white rounded-tr-sm" : "bg-white border border-slate-200 text-slate-800 rounded-tl-sm shadow-sm"}`}
        >
          {displayText && renderMarkdown(displayText)}

          {hasStructuredTherapists && (
            <div className="mt-2 sm:mt-3 flex flex-col gap-2">
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-1">
                Matching Therapists — tap to select
              </p>
              {sd!.therapists!.map((t) => (
                <TherapistCard
                  key={t.id}
                  therapist={t}
                  onSelect={onTherapistSelect ?? (() => {})}
                  disabled={isLoading}
                />
              ))}
            </div>
          )}

          {hasStructuredSlots && onSlotSelect && (
            <SlotCards
              slots={sd!.slots!}
              onSelect={onSlotSelect}
              disabled={isLoading}
            />
          )}

          {hasConfirmation && (
            <ConfirmationCard
              therapistName={sd!.confirmation!.therapistName}
              date={sd!.confirmation!.date}
              time={sd!.confirmation!.time}
              meetLink={sd!.confirmation!.meetLink}
              appointmentId={sd!.confirmation!.appointmentId}
            />
          )}

          {isOutOfScope && <OutOfScopeBadge />}

          {hasLegacyTherapists && (
            <div className="mt-2 sm:mt-3 flex flex-col gap-2">
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-1">
                Matching Therapists — tap to select
              </p>
              {legacyTherapists.map((t) => (
                <TherapistCard
                  key={t.name}
                  therapist={t}
                  onSelect={onTherapistSelect ?? (() => {})}
                  disabled={isLoading}
                />
              ))}
            </div>
          )}

          {hasLegacySlots && onSlotSelect && (
            <SlotCards
              slots={legacySlots}
              onSelect={onSlotSelect}
              disabled={isLoading}
            />
          )}
        </div>

        <span className="text-xs text-slate-400 px-1 flex-shrink-0">
          {formatTime(message.timestamp)}
        </span>
      </div>

      {isUser && (
        <div className="ml-1.5 sm:ml-2 flex-shrink-0 h-6 w-6 sm:h-8 sm:w-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 text-[9px] sm:text-xs font-bold self-start mt-0.5">
          You
        </div>
      )}
    </div>
  );
};
