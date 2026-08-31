// Classify each OCR line as chord / lyric / section-label / blank.
// The chord test reuses the app's parseChord, guarded against parseChord's
// permissive quality group (`.*?`) so lyric words like "Add" / "Every" don't
// register as chords.

import { parseChord } from "../../lib/transpose";
import type { LineClass, OcrLine } from "./types";

/** Section-label line, e.g. "Verse 1", "CHORUS", "Bridge", "Pre-Chorus:". */
export const SECTION_LABEL_RE =
  /^\s*(?:\d+\s*[.)-]?\s*)?(verse|chorus|bridge|intro|outro|tag|refrain|ending|pre[-\s]?chorus|interlude|vamp|instrumental|coda)\b\s*\d*\s*[:.)-]?\s*$/i;

/** Tokens that are neither chord nor lyric — bar lines, repeats, "no chord". */
const NEUTRAL = new Set([
  "|",
  "||",
  "|:",
  ":|",
  ":||",
  "||:",
  "%",
  "/",
  "//",
  "-",
  "x2",
  "x3",
  "x4",
  "2x",
  "3x",
  "4x",
  "(x2)",
  "(x3)",
  "n.c.",
  "nc",
]);

// Play-duration / repeat markers chord charts hang off a chord: "D (2)",
// "A7 (2)", "D (hold)", "G(2". Neutral so they don't dilute a chord line into a
// lyric line, and don't get spliced in as `[2]`.
const DURATION_MARKER_RE = /^\(?(?:\d{1,2}|hold|rit|fine|cont\.?)\)?$/i;

/** A fret-tablature / diagram token: "xx0232", "320003", "x02020", "020100". */
const FRET_TAB_RE = /^[xX]{0,4}[0-9]{3,6}$/;

/** Known chord-quality atoms, longest-first so `maj7` is stripped before `maj`. */
const QUALITY_ATOMS = [
  "maj13",
  "maj11",
  "maj9",
  "maj7",
  "maj",
  "min",
  "dim",
  "aug",
  "sus2",
  "sus4",
  "sus",
  "add9",
  "add11",
  "add13",
  "add",
  "6",
  "7",
  "9",
  "11",
  "13",
  "m",
  "°",
  "ø",
  "+",
];

/** Strip wrapping punctuation an OCR pass leaves around a chord, e.g. "(G)," ->
 *  "G", and a trailing duration marker OCR glued on: "D(2" -> "D". */
export function normalizeChordToken(token: string): string {
  return token
    .replace(/^[([]+/, "")
    .replace(/\(\d{1,2}\)?$/, "")
    .replace(/[)\].,;:|]+$/, "");
}

/** True for bar lines, repeat/duration marks, "no chord" — counted as neither. */
export function isNeutralToken(token: string): boolean {
  return NEUTRAL.has(token.toLowerCase()) || DURATION_MARKER_RE.test(token);
}

/**
 * Fix the OCR confusions that turn a chord into junk on a chord line: a 7 read
 * as T (`A7` -> `AT`), and a stray leading O (`OD` -> `D`). Applied only where a
 * token is already in chord position.
 */
export function fixChordOcr(token: string): string {
  return token.replace(/^O([A-G])/, "$1").replace(/^([A-G][#b]?)T\b/, "$17");
}

/** A lone "|" in a lyric line is almost always a mis-OCR'd "I". */
export function fixLyricWord(word: string): string {
  return word === "|" ? "I" : word;
}

/**
 * True if the token is a real chord: parseChord accepts it AND the quality
 * string is built only from known atoms / alterations / a slash bass.
 */
export function isChordish(rawToken: string): boolean {
  const token = fixChordOcr(normalizeChordToken(rawToken));
  if (token === "" || token.length > 12) return false;
  if (FRET_TAB_RE.test(token)) return false;

  const parsed = parseChord(token);
  if (!parsed) return false;

  let q = parsed.quality;
  // parseChord already split off a trailing "/bass"; a leftover slash here is junk.
  if (q.includes("/")) return false;

  // Peel alterations like #5 / b9 / #11 first, then the named atoms.
  let progressed = true;
  while (progressed && q.length > 0) {
    progressed = false;
    const alt = /^[#b](?:5|9|11|13)/.exec(q);
    if (alt) {
      q = q.slice(alt[0].length);
      progressed = true;
      continue;
    }
    for (const atom of QUALITY_ATOMS) {
      if (q.startsWith(atom)) {
        q = q.slice(atom.length);
        progressed = true;
        break;
      }
    }
  }
  return q === "";
}

export interface LineTokenCounts {
  nChord: number;
  nWord: number;
}

export function countTokens(line: OcrLine): LineTokenCounts {
  let nChord = 0;
  let nWord = 0;
  for (const raw of line.text.split(/\s+/)) {
    if (raw === "") continue;
    if (isNeutralToken(raw)) continue;
    if (FRET_TAB_RE.test(normalizeChordToken(raw))) continue;
    if (isChordish(raw)) nChord++;
    else nWord++;
  }
  return { nChord, nWord };
}

/**
 * Chord-diagram row, strum-count row, fret-finger row, strum-pattern row,
 * "Strum Pattern" / "Capo" header — carries no chords or lyrics.
 */
export function isJunkLine(line: OcrLine): boolean {
  const text = line.text.trim();
  if (text === "") return false;
  // Only digits / x / + / bar lines / dots — strum counts, fret-finger numbers.
  if (/^[\dxX+|/.·:\s-]+$/.test(text) && /\d/.test(text)) return true;
  if (/^(strum\s*pattern|capo|tempo|key\s*of)\b/i.test(text)) return true;
  const toks = text.split(/\s+/).filter((t) => t && !isNeutralToken(t));
  if (toks.length === 0) return false;
  const tabs = toks.filter((t) => FRET_TAB_RE.test(t)).length;
  if (tabs / toks.length >= 0.4) return true;
  // Strum notation: nearly every token is a 1-4 char down/up/muted/bass mark
  // ("d", "u", "D", "DU", "dudu", "x", or a bare bass-note letter), and at least
  // two of them aren't valid chords. A real "D D D" / "G C D" progression has
  // zero non-chord tokens and is left alone; "d Dd D" and "B du B d u" (under a
  // "Strum Pattern" header, OCR-merged or not) are dropped.
  if (toks.length < 2) return false;
  const strumShaped = toks.filter((t) => /^[duDUxXA-G]{1,4}$/.test(t));
  const nonChord = strumShaped.filter((t) => !isChordish(t)).length;
  return strumShaped.length / toks.length >= 0.8 && nonChord >= 2;
}

export function classifyLine(line: OcrLine): LineClass {
  const { nChord, nWord } = countTokens(line);

  if (nChord + nWord === 0) return "blank";
  if (isJunkLine(line)) return "blank";

  const words = line.text.trim().split(/\s+/).filter(Boolean);
  if (
    nChord === 0 &&
    line.text.trim().length <= 24 &&
    words.length <= 3 &&
    SECTION_LABEL_RE.test(line.text)
  ) {
    return "section";
  }

  if (nChord >= 1 && nChord / (nChord + nWord) >= 0.6) return "chord";

  return "lyric";
}
