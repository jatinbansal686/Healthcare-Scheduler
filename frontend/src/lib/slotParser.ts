// ============================================================
// lib/slotParser.ts
// Pure utility: parses available time slots from agent message text.
// No side effects. No backend changes. OCP: add patterns here only.
//
// The agent returns slots as bullet/numbered lists like:
//   "* Tuesday, Apr 28 at 10:00 AM"
//   "- Wednesday, Apr 29 at 2:00 PM"
//   "1. Friday, May 2 at 9:00 AM"
// ============================================================

import type { AvailableSlot } from "../types/agent.types";

// Regex patterns that match slot lines the agent produces.
// Order matters — more specific patterns first.
const SLOT_LINE_PATTERNS = [
  // "* Tuesday, Apr 28 at 10:00 AM" or "- Monday, May 5 at 2:00 PM"
  /^[\*\-•]\s+(.+(?:AM|PM).*)/i,
  // "1. Tuesday, Apr 28 at 10:00 AM"
  /^\d+\.\s+(.+(?:AM|PM).*)/i,
];

// Detect if the whole message is a slot-offering message.
// Must have 2+ slot lines to show cards — single items are just text.
const MIN_SLOTS_TO_SHOW_CARDS = 2;

// Phrases that indicate the agent is offering slots for selection
const SLOT_OFFERING_PHRASES = [
  /available.*slot/i,
  /available.*time/i,
  /open.*slot/i,
  /following.*slot/i,
  /following.*time/i,
  /which.*time.*work/i,
  /which.*slot/i,
  /pick.*time/i,
  /choose.*time/i,
  /select.*time/i,
  /here are.*available/i,
  /here are.*slot/i,
  /time slot.*work/i,
];

function isSlotOfferingMessage(text: string): boolean {
  return SLOT_OFFERING_PHRASES.some((re) => re.test(text));
}

function parseSlotLine(line: string): string | null {
  const trimmed = line.trim();
  for (const pattern of SLOT_LINE_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) return match[1].trim();
  }
  return null;
}

/**
 * Extracts AvailableSlot[] from an agent message string.
 * Returns empty array if the message doesn't contain slot listings.
 */
export function parseSlots(
  text: string,
  therapistName?: string,
  therapistId?: string,
): AvailableSlot[] {
  console.log("[slotParser] parseSlots called", { textLength: text.length });

  if (!isSlotOfferingMessage(text)) {
    console.log("[slotParser] Not a slot-offering message — skipping");
    return [];
  }

  const lines = text.split("\n");
  const slots: AvailableSlot[] = [];

  for (const line of lines) {
    const label = parseSlotLine(line);
    if (label) {
      slots.push({
        label,
        startTime: label, // raw label used as startTime for the booking message
        therapistName,
        therapistId,
      });
    }
  }

  if (slots.length < MIN_SLOTS_TO_SHOW_CARDS) {
    console.log("[slotParser] Not enough slots to show cards", {
      found: slots.length,
    });
    return [];
  }

  console.log("[slotParser] Parsed slots", { count: slots.length });
  return slots;
}

/**
 * Strips slot bullet lines from text so the card section
 * doesn't duplicate them as plain text.
 */
export function stripSlotLines(text: string): string {
  return text
    .split("\n")
    .filter((line) => !SLOT_LINE_PATTERNS.some((p) => p.test(line.trim())))
    .join("\n")
    .trim();
}
