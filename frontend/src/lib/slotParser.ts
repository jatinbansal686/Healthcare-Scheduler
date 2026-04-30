// ============================================================
// lib/slotParser.ts
// SOLID: OCP — add patterns here only, callers never change
// CHANGE: Made format-agnostic. Detects intent semantically,
// extracts from ANY markdown format (bullets, tables, numbered,
// prose, bold, plain). Works regardless of which AI or prompt
// produced the response.
// ============================================================

import type { AvailableSlot } from "../types/agent.types";

// ── Exported types ────────────────────────────────────────────
export interface ParsedTherapist {
  name: string;
  yearsExperience: number;
  specialties: string[];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// INTENT DETECTION
// Checks the full message for semantic meaning — not format
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const SLOT_INTENT_PATTERNS = [
  /available\s*(time|slot|appointment|opening)/i,
  /open\s*(slot|time|appointment)/i,
  /following\s*(slot|time|opening)/i,
  /which\s*(time|slot|day|appointment)/i,
  /pick\s*a?\s*(time|slot|day)/i,
  /choose\s*a?\s*(time|slot)/i,
  /select\s*a?\s*(time|slot)/i,
  /here\s+are\s*(the)?\s*(available|open)/i,
  /works\s+best\s+for\s+you/i,
  /next\s+(available|open)/i,
  /schedule\s*(for|with|an)\s+appointment/i,
  /time\s+slot/i,
];

const THERAPIST_INTENT_PATTERNS = [
  /here\s+are\s*(the)?\s*(some)?\s*(matching|available|our)?\s*therapist/i,
  /following\s+therapist/i,
  /therapist.*speciali/i,
  /match.*therapist/i,
  /therapist.*match/i,
  /which\s+therapist/i,
  /years\s+(of\s+)?experience/i,
  /several\s+therapist/i,
  /take\s+a\s+look\s+at/i,
  /found\s+(some|these|the\s+following)?\s*therapist/i,
  /recommend.*therapist/i,
  /therapist.*available/i,
  /see\s+(any\s+of\s+)?these\s+therapist/i,
  /like\s+to\s+(see|meet)\s+with/i,
];

export function isSlotOfferingMessage(text: string): boolean {
  return SLOT_INTENT_PATTERNS.some((re) => re.test(text));
}

export function isTherapistListingMessage(text: string): boolean {
  return THERAPIST_INTENT_PATTERNS.some((re) => re.test(text));
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SHARED UTILITIES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** Strip markdown formatting from a string */
function stripMd(s: string): string {
  return s
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1") // bold/italic
    .replace(/_{1,2}([^_]+)_{1,2}/g, "$1") // underscore bold
    .replace(/`([^`]+)`/g, "$1") // inline code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // links
    .trim();
}

/** Extract pipe-delimited table cells from a line */
function tableCells(line: string): string[] {
  return line
    .split("|")
    .map((c) => stripMd(c).trim())
    .filter((c) => c.length > 0 && !/^[-:\s]+$/.test(c));
}

const TABLE_SEPARATOR_RE = /^\|[\s\-:|]+\|/;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SLOT PARSING
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// A "slot line" must contain a time-of-day (AM/PM or HH:MM)
const TIME_RE = /\d{1,2}:\d{2}\s*(AM|PM)?|\d{1,2}\s*(AM|PM)/i;
// Must also look like a date/day reference
const DATE_RE =
  /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{1,2}\/\d{1,2}|\d{4}-\d{2}-\d{2}|today|tomorrow)\b/i;

function looksLikeSlot(text: string): boolean {
  return TIME_RE.test(text) && DATE_RE.test(text);
}

function cleanSlotLabel(raw: string): string {
  const cleaned = raw
    .replace(/^[\d#]+[.):\s]+/, "")
    .replace(/\s*[−–—]\s*/g, " - ")
    .replace(/\s{2,}/g, " ")
    .trim();

  // Truncate after first complete time (e.g. "9:00 AM")
  // Removes trailing 24h ranges like "- 9:00 - 9:50 AM" or "- 14:00 - 14:50 PM"
  const firstTimeMatch = cleaned.match(/\d{1,2}:\d{2}\s*(?:AM|PM)/i);
  if (firstTimeMatch && firstTimeMatch.index !== undefined) {
    return cleaned
      .slice(0, firstTimeMatch.index + firstTimeMatch[0].length)
      .trim();
  }
  return cleaned;
}

/**
 * Try to extract a slot label from any line format:
 *   - Bullet: "* Tuesday, Apr 29 at 10:00 AM"
 *   - Numbered: "1. Tuesday Apr 29 at 10:00 AM"
 *   - Table: "| 1 | Tuesday, Apr 29 | 10:00 AM |"
 *   - Table (no index): "| Tuesday, Apr 29 at 10:00 AM |"
 *   - Plain: "Tuesday, Apr 29 at 10:00 AM"
 *   - Bold: "**Tuesday, Apr 29** at 10:00 AM"
 */
function extractSlotFromLine(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed || TABLE_SEPARATOR_RE.test(trimmed)) return null;

  // Table row — use ONLY the first slot-looking cell, never join multiple
  if (trimmed.startsWith("|")) {
    const cells = tableCells(trimmed);

    // Skip index-only first cell (pure number)
    const dataCells =
      cells[0] && /^\d+$/.test(cells[0]) ? cells.slice(1) : cells;

    // Case 1: a single cell already contains both date and time → use it directly
    const selfContained = dataCells.find((c) => looksLikeSlot(c));
    if (selfContained) return cleanSlotLabel(selfContained);

    // Case 2: date and time are in separate adjacent cells → merge first pair only
    const dateCell = dataCells.find((c) => DATE_RE.test(c) && !TIME_RE.test(c));
    const timeCell = dataCells.find((c) => TIME_RE.test(c));
    if (dateCell && timeCell)
      return cleanSlotLabel(`${dateCell} at ${timeCell}`);

    return null;
  }

  // Bullet or numbered list
  const stripped = stripMd(trimmed)
    .replace(/^[-*•]\s+/, "") // bullet
    .replace(/^\d+[.)]\s+/, ""); // numbered

  if (looksLikeSlot(stripped)) return cleanSlotLabel(stripped);
  return null;
}

const MIN_SLOTS = 2;

export function parseSlots(
  text: string,
  therapistName?: string,
  therapistId?: string,
): AvailableSlot[] {
  if (!isSlotOfferingMessage(text)) return [];

  const slots: AvailableSlot[] = [];
  for (const line of text.split("\n")) {
    const label = extractSlotFromLine(line);
    if (label)
      slots.push({ label, startTime: label, therapistName, therapistId });
  }

  return slots.length >= MIN_SLOTS ? slots : [];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// THERAPIST PARSING
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Recognise therapist name: "Dr. X" or "FirstName LastName, CREDENTIAL"
const THERAPIST_NAME_RE =
  /^(Dr\.?\s+[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*(?:,\s*(?:Psy\.D\.|LCSW|LMFT|LCPC|PhD|MD|MA|MS|LPC|MFT))?|[A-Z][a-zA-Z]+\s+[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*(?:,\s*(?:Psy\.D\.|LCSW|LMFT|LCPC|PhD|MD|MA|MS|LPC|MFT))?)/;

function parseYears(text: string): number {
  const m = text.match(/(\d+)\s*(?:\+)?\s*(?:yrs?|years?)/i);
  return m ? parseInt(m[1], 10) : 0;
}

function parseSpecialties(text: string): string[] {
  // Remove credential suffixes and years
  const cleaned = text
    .replace(/\d+\s*(?:\+)?\s*(?:yrs?|years?)[^,]*/gi, "")
    .replace(/(?:Psy\.D\.|LCSW|LMFT|LCPC|PhD|MD|MA|MS|LPC|MFT)/gi, "")
    .replace(/speciali(?:zes?|ties?)\s+in:?/i, "");
  return cleaned
    .split(/[,;|]/)
    .map((s) => s.trim().replace(/^[-•*]\s*/, ""))
    .filter((s) => s.length > 2 && s.length < 50 && /[a-z]/i.test(s));
}

/**
 * Try to extract therapist from any line format:
 *   Table: "| 1 | Dr. Sarah Mitchell, Psy.D. | 12 years | Anxiety, Depression |"
 *   Table no-index: "| Dr. Sarah | 12 yrs | Anxiety |"
 *   Bullet: "* **Dr. Sarah Mitchell** — 12 yrs, Anxiety, Depression"
 *   Numbered: "1. Dr. Sarah Mitchell (12 years) — Anxiety"
 *   Bold heading: "**Dr. Sarah Mitchell, Psy.D.** — specializes in anxiety"
 */
function extractTherapistFromLine(line: string): ParsedTherapist | null {
  const trimmed = line.trim();
  if (!trimmed || TABLE_SEPARATOR_RE.test(trimmed)) return null;

  // ── Table row ─────────────────────────────────────────────
  if (trimmed.startsWith("|")) {
    const cells = tableCells(trimmed);
    if (cells.length < 2) return null;

    // Skip header rows
    if (/^(name|therapist|#|no\.?)$/i.test(cells[0])) return null;

    // Find which cell is the name
    let nameCell = "";
    let restCells: string[] = [];

    // First cell could be index number — skip it
    if (/^\d+$/.test(cells[0])) {
      nameCell = cells[1] ?? "";
      restCells = cells.slice(2);
    } else {
      nameCell = cells[0];
      restCells = cells.slice(1);
    }

    if (!THERAPIST_NAME_RE.test(nameCell)) return null;

    const rest = restCells.join(" ");
    return {
      name: nameCell,
      yearsExperience: parseYears(rest),
      specialties: parseSpecialties(rest),
    };
  }

  // ── Bullet / numbered / bold line ─────────────────────────
  const stripped = stripMd(trimmed)
    .replace(/^[-*•]\s+/, "")
    .replace(/^\d+[.)]\s+/, "");

  const nameMatch = stripped.match(THERAPIST_NAME_RE);
  if (!nameMatch) return null;

  const name = nameMatch[0].trim();
  // Skip generic header words
  if (/^(therapist|name|doctor)s?$/i.test(name)) return null;

  const rest = stripped.slice(name.length).replace(/^[\s:,—–\-]+/, "");
  return {
    name,
    yearsExperience: parseYears(rest),
    specialties: parseSpecialties(rest),
  };
}

const MIN_THERAPISTS = 1;

export function parseTherapists(text: string): ParsedTherapist[] {
  if (!isTherapistListingMessage(text)) return [];

  const therapists: ParsedTherapist[] = [];
  const seen = new Set<string>();

  for (const line of text.split("\n")) {
    const t = extractTherapistFromLine(line);
    if (t && !seen.has(t.name)) {
      seen.add(t.name);
      therapists.push(t);
    }
  }

  return therapists.length >= MIN_THERAPISTS ? therapists : [];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STRIP HELPERS (used by MessageBubble to hide parsed lines)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function stripSlotLines(text: string): string {
  return text
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      if (TABLE_SEPARATOR_RE.test(t)) return false;
      return !extractSlotFromLine(t);
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function stripTherapistLines(text: string): string {
  if (!isTherapistListingMessage(text)) return text;
  return text
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      if (TABLE_SEPARATOR_RE.test(t)) return false;
      if (t.startsWith("|")) return false; // strip all table rows
      // Strip therapist bullet lines
      return !extractTherapistFromLine(t);
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// THE ABOVE PARSER IS OLD BUT 99/100 TIMES HANDLES ALL THE RESPONES
