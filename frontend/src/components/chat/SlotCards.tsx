// ============================================================
// components/chat/SlotCards.tsx
// ============================================================

import React from "react";
import type { AvailableSlot } from "../../types/agent.types";

interface SlotCardsProps {
  slots: AvailableSlot[];
  onSelect: (slot: AvailableSlot) => void;
  disabled?: boolean;
}

function parseDisplayParts(label: string): {
  day: string;
  date: string;
  time: string;
} {
  console.log("[SlotCards] Parsing slot label:", label);

  const match = label.match(
    /^(\w+),?\s+([\w]+\.?\s+\d+)\s+at\s+(\d+:\d+\s*(?:AM|PM))/i,
  );
  if (match) {
    return { day: match[1], date: match[2], time: match[3] };
  }

  const parts = label.split(/\s+at\s+/i);
  if (parts.length === 2) {
    const dateParts = parts[0].split(",").map((s) => s.trim());
    return {
      day: dateParts[0] ?? "",
      date: dateParts[1] ?? parts[0],
      time: parts[1],
    };
  }

  return { day: "", date: label, time: "" };
}

export const SlotCards: React.FC<SlotCardsProps> = ({
  slots,
  onSelect,
  disabled,
}) => {
  console.log("[SlotCards] render", { slotCount: slots.length, disabled });

  return (
    <div className="mt-2 sm:mt-3 flex flex-col gap-2">
      <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-1">
        Available Slots — tap to book
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {slots.map((slot, i) => {
          const { day, date, time } = parseDisplayParts(slot.label);

          return (
            <button
              key={i}
              onClick={() => {
                console.log("[SlotCards] Slot selected:", slot.label);
                onSelect(slot);
              }}
              disabled={disabled}
              className="
                group flex items-center gap-2 sm:gap-3 rounded-xl border border-teal-200
                bg-teal-50 px-3 sm:px-4 py-2.5 sm:py-3 text-left transition-all duration-150
                hover:border-teal-400 hover:bg-teal-100 hover:shadow-md
                active:scale-[0.98]
                disabled:opacity-50 disabled:cursor-not-allowed
                focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-1
              "
            >
              {/* Calendar icon */}
              <div className="flex-shrink-0 h-8 w-8 sm:h-9 sm:w-9 rounded-lg bg-teal-600 flex items-center justify-center text-white">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 sm:h-5 sm:w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>

              {/* Slot details */}
              <div className="flex-1 min-w-0">
                {day && (
                  <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide">
                    {day}
                  </p>
                )}
                {date && (
                  <p className="text-xs sm:text-sm font-medium text-slate-800 truncate">
                    {date}
                  </p>
                )}
                {time && (
                  <p className="text-xs sm:text-sm text-teal-600 font-semibold">
                    {time}
                  </p>
                )}
                {!day && !date && (
                  <p className="text-xs sm:text-sm font-medium text-slate-800">
                    {slot.label}
                  </p>
                )}
              </div>

              {/* Arrow */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 text-teal-400 group-hover:text-teal-600 transition-colors flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          );
        })}
      </div>
    </div>
  );
};
