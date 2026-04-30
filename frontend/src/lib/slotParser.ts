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


// ============================================================
// lib/slotParser.ts
// SOLID: OCP — callers never change, only this file extends.
// Fully dynamic: no hardcoded format assumptions.
// Strategy: token-based detection → works for any AI, any prompt.
// ============================================================

// import type { AvailableSlot } from "../types/agent.types";

// export interface ParsedTherapist {
//   name: string;
//   yearsExperience: number;
//   specialties: string[];
// }

// // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// // CORE TOKENS — what makes something a slot or a therapist
// // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// // Matches any time expression: 9:00 AM / 14:00 / 9AM / 09:00 UTC
// const TIME_TOKEN =
//   /\b(\d{1,2}:\d{2}\s*(?:AM|PM|UTC|EST|CST|PST|GMT)?|\d{1,2}\s*(?:AM|PM))\b/i;

// // Matches any date/day token
// const DATE_TOKEN =
//   /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun|january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec|\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?|\d{4}-\d{2}-\d{2}|today|tomorrow|next\s+\w+)\b/i;

// function hasTime(s: string): boolean {
//   return TIME_TOKEN.test(s);
// }
// function hasDate(s: string): boolean {
//   return DATE_TOKEN.test(s);
// }
// function looksLikeSlot(s: string): boolean {
//   return hasDate(s) && hasTime(s);
// }

// // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// // INTENT DETECTION — semantic, not format-based
// // Falls back to structural detection if no phrase matches
// // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// const SLOT_INTENT_RE = [
//   /available\s*(time|slot|appointment|opening)/i,
//   /open\s*(slot|time|appointment)/i,
//   /following\s*(slot|time|opening|appointment)/i,
//   /upcoming\s*(slot|time|appointment|opening)/i,
//   /next\s*(available|open|upcoming)/i,
//   /which\s*(time|slot|day|appointment|date)/i,
//   /pick\s*a?\s*(time|slot|day|date)/i,
//   /choose\s*a?\s*(time|slot|date)/i,
//   /select\s*a?\s*(time|slot|date)/i,
//   /here\s+are\s*(the|some|my)?\s*(available|open|upcoming|next)/i,
//   /here\s+are\s*(the|some)?\s*(slot|time|appointment)/i,
//   /works?\s+best\s+for\s+you/i,
//   /time\s+slot/i,
//   /please\s+(pick|choose|select|let\s+me\s+know)/i,
//   /go\s+ahead\s+and\s+(pick|choose|select)/i,
//   /just\s+(reply|let\s+me\s+know|say|pick)\s+.{0,30}(time|slot|number|date)/i,
//   /lock\s+(it|that)\s+in/i,
//   /secure\s+(the|your)\s+appointment/i,
//   /has\s+(the\s+)?following\s+(slot|time|opening)/i,
//   /slots?\s+for\s+/i,
//   /appointment\s+slot/i,
// ];

// const THERAPIST_INTENT_RE = [
//   /here\s+are\s*(the|some)?\s*(matching|available|our|a\s+few)?\s*therapist/i,
//   /following\s+therapist/i,
//   /found\s+(some|these|the\s+following|a\s+few)?\s*therapist/i,
//   /therapist.*speciali/i,
//   /match.*therapist/i,
//   /therapist.*match/i,
//   /which\s+therapist/i,
//   /years?\s+(of\s+)?experience/i,
//   /several\s+therapist/i,
//   /take\s+a\s+look\s+at/i,
//   /recommend.*therapist/i,
//   /therapist.*available/i,
//   /see\s+(any\s+of\s+)?these\s+therapist/i,
//   /like\s+to\s+(see|meet|work)\s+with/i,
//   /introduce\s+you\s+to/i,
//   /great\s+(match|fit)\s+for\s+you/i,
//   /options?\s+for\s+you/i,
// ];

// export function isSlotOfferingMessage(text: string): boolean {
//   if (SLOT_INTENT_RE.some((re) => re.test(text))) return true;
//   // Structural fallback: if the message has 2+ lines that look like slots
//   const slotLines = text.split("\n").filter((l) => looksLikeSlot(l.trim()));
//   return slotLines.length >= 2;
// }

// export function isTherapistListingMessage(text: string): boolean {
//   if (THERAPIST_INTENT_RE.some((re) => re.test(text))) return true;
//   // Structural fallback: 2+ lines with therapist name pattern
//   const therapistLines = text
//     .split("\n")
//     .filter((l) => extractTherapistFromLine(l) !== null);
//   return therapistLines.length >= 2;
// }

// // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// // SHARED UTILITIES
// // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// function stripMd(s: string): string {
//   return (
//     s
//       .replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1")
//       .replace(/_{1,2}([^_]+)_{1,2}/g, "$1")
//       .replace(/`([^`]+)`/g, "$1")
//       .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
//       // Strip emoji (common in some AI responses)
//       .replace(
//         /[\u{1F300}-\u{1FFFF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu,
//         "",
//       )
//       .trim()
//   );
// }

// function tableCells(line: string): string[] {
//   return line
//     .split("|")
//     .map((c) => stripMd(c).trim())
//     .filter((c) => c.length > 0 && !/^[-:\s]+$/.test(c));
// }

// const TABLE_SEP_RE = /^\|[\s\-:|]+\|/;

// // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// // SLOT LABEL CLEANING
// // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// function cleanSlotLabel(raw: string): string {
//   const cleaned = raw
//     .replace(/^[\d#🔢]+[.):\s]*/u, "") // leading index or emoji number
//     .replace(/\s*[−–—]\s*/g, " - ")
//     .replace(/\s{2,}/g, " ")
//     .trim();

//   // Truncate after the FIRST complete time expression with AM/PM
//   // Handles: "9:00 AM - 9:00 - 9:50 AM", "9:00 AM UTC Monday..."
//   const amPmMatch = cleaned.match(/\d{1,2}:\d{2}\s*(?:AM|PM)/i);
//   if (amPmMatch && amPmMatch.index !== undefined) {
//     const truncated = cleaned
//       .slice(0, amPmMatch.index + amPmMatch[0].length)
//       .trim();
//     // Make sure we still have a date — if truncation removed it, keep original
//     if (hasDate(truncated)) return truncated;
//   }

//   // For 24h times without AM/PM, truncate after first HH:MM
//   const h24Match = cleaned.match(/\b\d{1,2}:\d{2}\b/);
//   if (h24Match && h24Match.index !== undefined) {
//     const truncated = cleaned
//       .slice(0, h24Match.index + h24Match[0].length)
//       .trim();
//     if (hasDate(truncated)) return truncated;
//   }

//   return cleaned;
// }

// // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// // SLOT LINE EXTRACTION
// // Handles: table | bullet | numbered | emoji | prose | bold | colon
// // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// // Lines that are questions or instructions — never a slot
// const QUESTION_LINE_RE =
//   /(\?|which\s+(of|one|time|slot|date)|just\s+(give|reply|let|say)|e\.g\.|for\s+example|such\s+as|like\s+"|\bplease\b|\benter\b|\btype\b)/i;

// function extractSlotFromLine(line: string): string | null {
//   const trimmed = line.trim();
//   if (!trimmed || TABLE_SEP_RE.test(trimmed)) return null;
//   // Reject question/instruction lines even if they contain a time token
//   if (QUESTION_LINE_RE.test(trimmed)) return null;

//   // ── Table row ─────────────────────────────────────────────
//   if (trimmed.startsWith("|")) {
//     const cells = tableCells(trimmed);
//     // Skip pure header/separator rows
//     if (
//       cells.every((c) =>
//         /^(#|no\.?|slot|time|date|day|utc|central|local)$/i.test(c),
//       )
//     )
//       return null;

//     // Drop leading index cell (pure number or #N)
//     const dataCells = /^#?\d+$/.test(cells[0] ?? "") ? cells.slice(1) : cells;

//     // Case 1: a cell contains both date + time
//     const self = dataCells.find((c) => looksLikeSlot(c));
//     if (self) return cleanSlotLabel(self);

//     // Case 2: separate date cell + time cell
//     const dateCell = dataCells.find((c) => hasDate(c) && !hasTime(c));
//     const timeCell = dataCells.find((c) => hasTime(c) && !hasDate(c));
//     if (dateCell && timeCell)
//       return cleanSlotLabel(`${dateCell} at ${timeCell}`);

//     // Case 3: first cell has date, any cell has time (multi-timezone table)
//     const firstDateCell = dataCells.find((c) => hasDate(c));
//     const firstTimeCell = dataCells.find((c) => hasTime(c));
//     if (firstDateCell && firstTimeCell && firstDateCell !== firstTimeCell) {
//       return cleanSlotLabel(`${firstDateCell} at ${firstTimeCell}`);
//     }

//     return null;
//   }

//   // ── Non-table line: strip all list/bullet/emoji prefixes ──
//   const stripped = stripMd(trimmed)
//     .replace(/^[-*•·▪▸►➤✓✔]\s+/, "") // bullet chars
//     .replace(/^\d+[.)]\s+/, "") // numbered list
//     .replace(/^[①②③④⑤⑥⑦⑧⑨⑩]\s*/u, ""); // circled numbers

//   if (looksLikeSlot(stripped)) return cleanSlotLabel(stripped);

//   // ── Prose sentence containing a slot ─────────────────────
//   // e.g. "Monday May 4 at 9:00 AM is available"
//   // Extract just the date+time portion
//   if (looksLikeSlot(stripped)) return cleanSlotLabel(stripped);

//   // Try extracting date+time span from a longer prose sentence
//   const dateMatch = stripped.match(DATE_TOKEN);
//   const timeMatch = stripped.match(TIME_TOKEN);
//   if (dateMatch && timeMatch) {
//     // Only treat as a slot line if the sentence is short (not a paragraph)
//     if (stripped.length < 120) {
//       return cleanSlotLabel(stripped);
//     }
//   }

//   return null;
// }

// // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// // PUBLIC: parseSlots
// // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// const MIN_SLOTS = 2;

// export function parseSlots(
//   text: string,
//   therapistName?: string,
//   therapistId?: string,
// ): AvailableSlot[] {
//   if (!isSlotOfferingMessage(text)) return [];

//   const slots: AvailableSlot[] = [];
//   const seen = new Set<string>();

//   for (const line of text.split("\n")) {
//     const label = extractSlotFromLine(line);
//     if (label && !seen.has(label)) {
//       seen.add(label);
//       slots.push({ label, startTime: label, therapistName, therapistId });
//     }
//   }

//   return slots.length >= MIN_SLOTS ? slots : [];
// }

// // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// // THERAPIST PARSING
// // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// // Credentials that confirm a name is a therapist
// const CREDENTIALS_RE =
//   /Psy\.D\.|LCSW|LMFT|LCPC|LPC|MFT|PhD|Ph\.D\.|MD|M\.D\.|MA|MS|MSW/i;

// // Name pattern: "Dr. X Y" OR "Firstname Lastname" (2-3 words, title-case)
// const NAME_RE =
//   /^(Dr\.?\s+)?([A-Z][a-záéíóúàèìòùäëïöüñ]+(?:\s+[A-Z][a-záéíóúàèìòùäëïöüñ]+){1,2})/;

// function isLikelyTherapistName(name: string): boolean {
//   if (/^(therapist|name|doctor|provider|clinician|staff)s?$/i.test(name))
//     return false;
//   if (name.split(" ").length < 2) return false;
//   return true;
// }

// function parseYears(text: string): number {
//   const m = text.match(/(\d+)\s*\+?\s*(?:yrs?|years?)/i);
//   return m ? parseInt(m[1], 10) : 0;
// }

// function parseSpecialties(text: string): string[] {
//   const cleaned = text
//     .replace(/\d+\s*\+?\s*(?:yrs?|years?)[^,]*/gi, "")
//     .replace(CREDENTIALS_RE, "")
//     .replace(/speciali(?:zes?|ties?|st)\s+in:?/i, "")
//     .replace(/focuses?\s+on:?/i, "")
//     .replace(/works?\s+with:?/i, "");

//   return cleaned
//     .split(/[,;|\/]/)
//     .map((s) =>
//       s
//         .trim()
//         .replace(/^[-•*·]\s*/, "")
//         .replace(/\(.*?\)/g, "")
//         .trim(),
//     )
//     .filter((s) => s.length > 2 && s.length < 60 && /[a-z]/i.test(s));
// }

// function extractTherapistFromLine(line: string): ParsedTherapist | null {
//   const trimmed = line.trim();
//   if (!trimmed || TABLE_SEP_RE.test(trimmed)) return null;
//   // Reject question/instruction lines even if they contain a time token
//   if (QUESTION_LINE_RE.test(trimmed)) return null;

//   // ── Table row ─────────────────────────────────────────────
//   if (trimmed.startsWith("|")) {
//     const cells = tableCells(trimmed);
//     if (cells.length < 2) return null;

//     // Drop index cell
//     const hasDrOrCredential =
//       /^Dr\./.test(cells[0]) || CREDENTIALS_RE.test(cells[0]);
//     const isIndex = /^#?\d+$/.test(cells[0] ?? "");

//     let nameCell = isIndex && !hasDrOrCredential ? (cells[1] ?? "") : cells[0];
//     const restCells =
//       isIndex && !hasDrOrCredential ? cells.slice(2) : cells.slice(1);

//     const nameMatch = nameCell.match(NAME_RE);
//     if (!nameMatch) return null;
//     const name = nameMatch[0].trim();
//     if (!isLikelyTherapistName(name)) return null;

//     const rest = restCells.join(" ");
//     return {
//       name,
//       yearsExperience: parseYears(nameCell + " " + rest),
//       specialties: parseSpecialties(rest),
//     };
//   }

//   // ── Bullet / numbered / bold / prose ─────────────────────
//   const stripped = stripMd(trimmed)
//     .replace(/^[-*•·▸►]\s+/, "")
//     .replace(/^\d+[.)]\s+/, "");

//   const nameMatch = stripped.match(NAME_RE);
//   if (!nameMatch) return null;

//   const name = nameMatch[0].trim();
//   if (!isLikelyTherapistName(name)) return null;

//   // Must have either a credential OR years OR specialties to confirm it's a therapist listing
//   const rest = stripped.slice(name.length).replace(/^[\s:,—–\-]+/, "");
//   const hasCredential = CREDENTIALS_RE.test(stripped);
//   const hasYears = /\d+\s*\+?\s*(?:yrs?|years?)/i.test(rest);
//   const hasSpecialties = rest.length > 5;

//   if (!hasCredential && !hasYears && !hasSpecialties) return null;

//   return {
//     name,
//     yearsExperience: parseYears(rest),
//     specialties: parseSpecialties(rest),
//   };
// }

// // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// // PUBLIC: parseTherapists
// // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// const MIN_THERAPISTS = 1;

// export function parseTherapists(text: string): ParsedTherapist[] {
//   if (!isTherapistListingMessage(text)) return [];

//   const therapists: ParsedTherapist[] = [];
//   const seen = new Set<string>();

//   for (const line of text.split("\n")) {
//     const t = extractTherapistFromLine(line);
//     if (t && !seen.has(t.name)) {
//       seen.add(t.name);
//       therapists.push(t);
//     }
//   }

//   return therapists.length >= MIN_THERAPISTS ? therapists : [];
// }

// // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// // STRIP HELPERS
// // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// export function stripSlotLines(text: string): string {
//   return text
//     .split("\n")
//     .filter((line) => {
//       const t = line.trim();
//       if (TABLE_SEP_RE.test(t)) return false;
//       return !extractSlotFromLine(t);
//     })
//     .join("\n")
//     .replace(/\n{3,}/g, "\n\n")
//     .trim();
// }

// export function stripTherapistLines(text: string): string {
//   if (!isTherapistListingMessage(text)) return text;
//   return text
//     .split("\n")
//     .filter((line) => {
//       const t = line.trim();
//       if (TABLE_SEP_RE.test(t)) return false;
//       if (t.startsWith("|")) return false;
//       return !extractTherapistFromLine(t);
//     })
//     .join("\n")
//     .replace(/\n{3,}/g, "\n\n")
//     .trim();
// }
