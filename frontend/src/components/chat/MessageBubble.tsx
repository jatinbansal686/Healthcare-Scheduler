// import React from "react";
// import type { ChatMessage, AvailableSlot } from "../../types/agent.types";
// import { SlotCards } from "./SlotCards";
// import {
//   stripSlotLines,
//   stripTherapistLines,
//   parseTherapists,
//   isTherapistListingMessage,
//   type ParsedTherapist,
// } from "../../lib/slotParser";

// interface MessageBubbleProps {
//   message: ChatMessage;
//   onSlotSelect?: (slot: AvailableSlot) => void;
//   onTherapistSelect?: (name: string) => void;
//   isLoading?: boolean;
// }

// function formatTime(iso: string): string {
//   try {
//     return new Date(iso).toLocaleTimeString([], {
//       hour: "2-digit",
//       minute: "2-digit",
//     });
//   } catch {
//     return "";
//   }
// }

// function renderMarkdown(text: string) {
//   return text.split("\n").map((line, i, arr) => (
//     <React.Fragment key={i}>
//       {renderBoldInline(line)}
//       {i < arr.length - 1 && <br />}
//     </React.Fragment>
//   ));
// }

// function renderBoldInline(line: string): React.ReactNode {
//   const parts = line.split(/(\*{1,2}[^*]+\*{1,2})/g);
//   if (parts.length === 1) return line;
//   return parts.map((part, i) => {
//     const boldMatch = part.match(/^\*{1,2}([^*]+)\*{1,2}$/);
//     if (boldMatch) return <strong key={i}>{boldMatch[1]}</strong>;
//     return <React.Fragment key={i}>{part}</React.Fragment>;
//   });
// }

// function TherapistCard({
//   therapist,
//   onSelect,
//   disabled,
// }: {
//   therapist: ParsedTherapist;
//   onSelect: (name: string) => void;
//   disabled: boolean;
// }) {
//   return (
//     <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-teal-50 hover:border-teal-300 transition-colors">
//       <div className="flex flex-col gap-0.5 flex-1 min-w-0 mr-2 sm:mr-3">
//         <span className="text-sm font-semibold text-slate-800 truncate">
//           {therapist.name}
//         </span>
//         {therapist.yearsExperience > 0 && (
//           <span className="text-xs text-slate-400">
//             {therapist.yearsExperience} yrs experience
//           </span>
//         )}
//         {therapist.specialties.length > 0 && (
//           <div className="flex flex-wrap gap-1 mt-1">
//             {therapist.specialties.slice(0, 3).map((s) => (
//               <span
//                 key={s}
//                 className="inline-block rounded-full px-2 py-0.5 text-xs bg-teal-100 text-teal-700"
//               >
//                 {s}
//               </span>
//             ))}
//           </div>
//         )}
//       </div>
//       <button
//         onClick={() => onSelect(therapist.name)}
//         disabled={disabled}
//         className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 text-xs bg-teal-600 text-white rounded-md hover:bg-teal-700 disabled:opacity-40 transition-colors"
//       >
//         Select
//       </button>
//     </div>
//   );
// }

// export const MessageBubble: React.FC<MessageBubbleProps> = ({
//   message,
//   onSlotSelect,
//   onTherapistSelect,
//   isLoading = false,
// }) => {
//   const isUser = message.sender === "user";

//   const hasSlots = !isUser && !!message.slots && message.slots.length > 0;

//   const therapists: ParsedTherapist[] = !isUser
//     ? parseTherapists(message.text)
//     : [];
//   const hasTherapists = therapists.length >= 1;

//   let displayText = message.text;
//   if (hasSlots) displayText = stripSlotLines(displayText);
//   if (hasTherapists) displayText = stripTherapistLines(displayText);

//   return (
//     <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
//       {!isUser && (
//         <div className="mr-1.5 sm:mr-2 flex-shrink-0 h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 text-xs sm:text-sm font-bold">
//           AI
//         </div>
//       )}

//       <div
//         className={`${
//           hasSlots || hasTherapists
//             ? "max-w-[92%] sm:max-w-[90%] md:max-w-[85%]"
//             : "max-w-[80%] sm:max-w-[75%]"
//         } ${isUser ? "items-end" : "items-start"} flex flex-col gap-1`}
//       >
//         <div
//           className={`rounded-2xl px-3 sm:px-4 py-2 sm:py-2.5 text-sm leading-relaxed w-full ${
//             isUser
//               ? "bg-teal-600 text-white rounded-tr-sm"
//               : "bg-white border border-slate-200 text-slate-800 rounded-tl-sm shadow-sm"
//           }`}
//         >
//           {displayText && renderMarkdown(displayText)}

//           {hasTherapists && (
//             <div className="mt-2 sm:mt-3 flex flex-col gap-2">
//               <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-1">
//                 Matching Therapists — tap to select
//               </p>
//               {therapists.map((t) => (
//                 <TherapistCard
//                   key={t.name}
//                   therapist={t}
//                   onSelect={onTherapistSelect ?? (() => {})}
//                   disabled={isLoading}
//                 />
//               ))}
//             </div>
//           )}

//           {hasSlots && onSlotSelect && (
//             <SlotCards
//               slots={message.slots!}
//               onSelect={onSlotSelect}
//               disabled={isLoading}
//             />
//           )}
//         </div>

//         <span className="text-xs text-slate-400 px-1">
//           {formatTime(message.timestamp)}
//         </span>
//       </div>

//       {isUser && (
//         <div className="ml-1.5 sm:ml-2 flex-shrink-0 h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 text-xs sm:text-sm font-bold">
//           You
//         </div>
//       )}
//     </div>
//   );
// };

// ============================================================
// MessageBubble.tsx
// CHANGE: Prefers message.structuredData (from respondToUser tool)
//         over regex parsing for therapists and slots.
//         Legacy regex path kept 100% intact as fallback.
//         No existing props, types, or rendering logic removed.
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

function renderMarkdown(text: string) {
  return text.split("\n").map((line, i, arr) => (
    <React.Fragment key={i}>
      {renderBoldInline(line)}
      {i < arr.length - 1 && <br />}
    </React.Fragment>
  ));
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

// ── Therapist card — accepts both structured and parsed types ─
// TherapistOption (structured) and ParsedTherapist (legacy regex)
// share the same visual fields: name, yearsExperience, specialties.
interface TherapistCardProps {
  therapist: TherapistOption | ParsedTherapist;
  onSelect: (name: string) => void;
  disabled: boolean;
}

function TherapistCard({ therapist, onSelect, disabled }: TherapistCardProps) {
  return (
    <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-teal-50 hover:border-teal-300 transition-colors">
      <div className="flex flex-col gap-0.5 flex-1 min-w-0 mr-2 sm:mr-3">
        <span className="text-sm font-semibold text-slate-800 truncate">
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
        className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 text-xs bg-teal-600 text-white rounded-md hover:bg-teal-700 disabled:opacity-40 transition-colors"
      >
        Select
      </button>
    </div>
  );
}

// ── Confirmation card ─────────────────────────────────────────

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
          <span className="font-medium">Therapist:</span> {therapistName}
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
            className="inline-block mt-1 text-xs text-teal-600 underline hover:text-teal-800"
          >
            Join Google Meet
          </a>
        )}
      </div>
    </div>
  );
}

// ── Out-of-scope badge ────────────────────────────────────────

function OutOfScopeBadge() {
  return (
    <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
      <span>ℹ️</span>
      <span>Outside scheduling scope</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  onSlotSelect,
  onTherapistSelect,
  isLoading = false,
}) => {
  const isUser = message.sender === "user";
  const sd = message.structuredData; // structured path (preferred)

  // ── Determine what to render ──────────────────────────────
  // Priority 1: structuredData from respondToUser tool (typed, reliable)
  // Priority 2: legacy slots on message (from regex parser)
  // Priority 3: regex parse of message.text (original fallback)

  const hasStructuredTherapists =
    !isUser && sd?.ui_hint === "therapists" && (sd.therapists?.length ?? 0) > 0;

  const hasStructuredSlots =
    !isUser && sd?.ui_hint === "slots" && (sd.slots?.length ?? 0) > 0;

  const hasConfirmation =
    !isUser && sd?.ui_hint === "confirmation" && !!sd.confirmation;

  const isOutOfScope = !isUser && sd?.ui_hint === "out_of_scope";

  // Legacy fallback paths — only run when no structuredData
  const legacySlots = !isUser && !sd ? (message.slots ?? []) : [];
  const hasLegacySlots = legacySlots.length > 0;

  const legacyTherapists: ParsedTherapist[] =
    !isUser && !sd ? parseTherapists(message.text) : [];
  const hasLegacyTherapists = legacyTherapists.length >= 1;

  // ── Strip parsed content from display text ────────────────
  let displayText = message.text;
  if (hasLegacySlots) displayText = stripSlotLines(displayText);
  if (hasLegacyTherapists) displayText = stripTherapistLines(displayText);
  // For structured responses: message text is already a clean intro line
  // (the AI is instructed to keep it brief when ui_hint is slots/therapists)

  const hasExtras =
    hasStructuredTherapists ||
    hasStructuredSlots ||
    hasConfirmation ||
    isOutOfScope ||
    hasLegacySlots ||
    hasLegacyTherapists;

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      {!isUser && (
        <div className="mr-1.5 sm:mr-2 flex-shrink-0 h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 text-xs sm:text-sm font-bold">
          AI
        </div>
      )}

      <div
        className={`${
          hasExtras
            ? "max-w-[92%] sm:max-w-[90%] md:max-w-[85%]"
            : "max-w-[80%] sm:max-w-[75%]"
        } ${isUser ? "items-end" : "items-start"} flex flex-col gap-1`}
      >
        <div
          className={`rounded-2xl px-3 sm:px-4 py-2 sm:py-2.5 text-sm leading-relaxed w-full ${
            isUser
              ? "bg-teal-600 text-white rounded-tr-sm"
              : "bg-white border border-slate-200 text-slate-800 rounded-tl-sm shadow-sm"
          }`}
        >
          {displayText && renderMarkdown(displayText)}

          {/* ── Structured: therapist cards ── */}
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

          {/* ── Structured: slot cards ── */}
          {hasStructuredSlots && onSlotSelect && (
            <SlotCards
              slots={sd!.slots!}
              onSelect={onSlotSelect}
              disabled={isLoading}
            />
          )}

          {/* ── Structured: confirmation ── */}
          {hasConfirmation && (
            <ConfirmationCard
              therapistName={sd!.confirmation!.therapistName}
              date={sd!.confirmation!.date}
              time={sd!.confirmation!.time}
              meetLink={sd!.confirmation!.meetLink}
              appointmentId={sd!.confirmation!.appointmentId}
            />
          )}

          {/* ── Structured: out of scope ── */}
          {isOutOfScope && <OutOfScopeBadge />}

          {/* ── Legacy: therapist cards (regex fallback) ── */}
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

          {/* ── Legacy: slot cards (regex fallback) ── */}
          {hasLegacySlots && onSlotSelect && (
            <SlotCards
              slots={legacySlots}
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
        <div className="ml-1.5 sm:ml-2 flex-shrink-0 h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 text-xs sm:text-sm font-bold">
          You
        </div>
      )}
    </div>
  );
};
