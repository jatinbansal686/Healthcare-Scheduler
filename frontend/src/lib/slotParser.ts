// ============================================================
// lib/slotParser.ts
// Pure utility: parses slots and therapists from agent message text.
// OCP: add new patterns here only — callers never change.
// ============================================================

import type { AvailableSlot } from "../types/agent.types";

// ── Slot line patterns ────────────────────────────────────────
const SLOT_LINE_PATTERNS = [
  /^[\*\-•]\s+(.+(?:AM|PM).*)/i,
  /^\d+\.\s+(.+(?:AM|PM).*)/i,
  // OpenAI/DeepSeek table: "| 1 | Wednesday, Apr 29 −9:00 AM |"
  /^\|\s*\d+\s*\|\s*(.+(?:AM|PM)[^|]*)\|?/i,
  // OpenAI table WITHOUT leading number: "| **Monday, May 4** | 9:00 AM … |"
  /^\|\s*\*{0,2}(\w[^|]*(?:AM|PM)[^|]*)\*{0,2}\s*\|/i,
];

// ── Therapist table row ───────────────────────────────────────
// Handles both:
//   "| **1** | **Dr. Sarah Mitchell, Psy.D.** | 12 | Anxiety |"  (with index col)
//   "| **Dr. Sarah Mitchell, Psy.D.** | 12 years | Anxiety |"    (no index col)
const THERAPIST_TABLE_WITH_INDEX_RE =
  /^\|\s*\*{0,2}\d+\*{0,2}\s*\|\s*\*{0,2}([^|*]+?)\*{0,2}\s*\|\s*(\d+)[^|]*\|\s*([^|]+)\|/;
const THERAPIST_TABLE_NO_INDEX_RE =
  /^\|\s*\*{0,2}(Dr\.[^|*]+?|[A-Z][^|*]+?(?:LCSW|LMFT|Psy\.D\.|LCPC|MD|PhD|MA)[^|*]*?)\*{0,2}\s*\|\s*(\d+)[^|]*\|\s*([^|]+)\|/i;

// Separator rows: "|---|---| …"
const TABLE_SEPARATOR_RE = /^\|[\s\-:|]+\|/;

export interface ParsedTherapist {
  name: string;
  yearsExperience: number;
  specialties: string[];
}

// ── Detection phrases ─────────────────────────────────────────
const MIN_SLOTS_TO_SHOW_CARDS = 2;

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
  /next opening/i,
  /openings.*has/i,
  /works best for you/i,
];

const THERAPIST_LISTING_PHRASES = [
  /therapist.*speciali/i,
  /here are.*therapist/i,
  /following.*therapist/i,
  /match.*therapist/i,
  /therapist.*match/i,
  /which therapist/i,
  /years of experience/i,
  /years experience/i,
  /in-person.*therapist/i,
  /several.*therapist/i,
  /take a look at their/i,
];

export function isTherapistListingMessage(text: string): boolean {
  return THERAPIST_LISTING_PHRASES.some((re) => re.test(text));
}

function isSlotOfferingMessage(text: string): boolean {
  return SLOT_OFFERING_PHRASES.some((re) => re.test(text));
}

function parseSlotLine(line: string): string | null {
  const trimmed = line.trim();
  if (TABLE_SEPARATOR_RE.test(trimmed)) return null;
  for (const pattern of SLOT_LINE_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) {
      return match[1]
        .trim()
        .replace(/\*{1,2}/g, "") // strip markdown bold
        .replace(/\s*[−–]\s*/g, " - ")
        .replace(/\s{2,}/g, " ");
    }
  }
  return null;
}

export function parseSlots(
  text: string,
  therapistName?: string,
  therapistId?: string,
): AvailableSlot[] {
  if (!isSlotOfferingMessage(text)) return [];

  const slots: AvailableSlot[] = [];
  for (const line of text.split("\n")) {
    const label = parseSlotLine(line);
    if (label)
      slots.push({ label, startTime: label, therapistName, therapistId });
  }

  if (slots.length < MIN_SLOTS_TO_SHOW_CARDS) return [];
  return slots;
}

function parseTherapistTableRow(trimmed: string): ParsedTherapist | null {
  // Try with-index pattern first
  let match = trimmed.match(THERAPIST_TABLE_WITH_INDEX_RE);
  if (!match) match = trimmed.match(THERAPIST_TABLE_NO_INDEX_RE);
  if (!match) return null;

  const name = match[1].trim();
  if (/^therapist$/i.test(name) || /^name$/i.test(name)) return null; // skip header

  return {
    name,
    yearsExperience: parseInt(match[2], 10),
    specialties: match[3]
      .split(",")
      .map((s) =>
        s
          .trim()
          .replace(/\(.*?\)/g, "")
          .trim(),
      )
      .filter(Boolean),
  };
}

export function parseTherapists(text: string): ParsedTherapist[] {
  if (!isTherapistListingMessage(text)) return [];

  const therapists: ParsedTherapist[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();

    if (trimmed.startsWith("|")) {
      if (TABLE_SEPARATOR_RE.test(trimmed)) continue;
      const t = parseTherapistTableRow(trimmed);
      if (t) therapists.push(t);
      continue;
    }

    // Gemini bullet: "* **Dr. Sarah Mitchell** — 12 yrs, Anxiety"
    const geminiMatch = trimmed.match(
      /^[\*\-•]\s+\*{1,2}([^*]+)\*{1,2}[:\s—–\-]+(.*)/,
    );
    if (geminiMatch) {
      const name = geminiMatch[1].trim();
      const rest = geminiMatch[2].trim();
      const specialtyStr = rest.replace(/^\d+\s*(?:yrs?|years?)[,\s]*/i, "");
      const yearsMatch = rest.match(/(\d+)\s*(?:yrs?|years?)/i);
      therapists.push({
        name,
        yearsExperience: yearsMatch ? parseInt(yearsMatch[1], 10) : 0,
        specialties: specialtyStr
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      });
    }
  }

  return therapists;
}

export function stripSlotLines(text: string): string {
  return text
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      if (TABLE_SEPARATOR_RE.test(t)) return false;
      return !SLOT_LINE_PATTERNS.some((p) => p.test(t));
    })
    .join("\n")
    .trim();
}

export function stripTherapistLines(text: string): string {
  if (!isTherapistListingMessage(text)) return text;
  return text
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      if (!t.startsWith("|")) {
        // Keep non-table lines, but strip Gemini therapist bullets
        return !/^[\*\-•]\s+\*{1,2}[^*]+\*{1,2}[:\s—–\-]+/.test(t);
      }
      return false; // strip all table rows
    })
    .join("\n")
    .trim();
}
