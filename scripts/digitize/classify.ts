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

/** Strip wrapping punctuation an OCR pass leaves around a chord, e.g. "(G)," -> "G". */
export function normalizeChordToken(token: string): string {
  return token.replace(/^[([]+/, "").replace(/[)\].,;:|]+$/, "");
}

/** True for bar lines, repeat marks, "no chord" — counted as neither chord nor lyric. */
export function isNeutralToken(token: string): boolean {
  return NEUTRAL.has(token.toLowerCase());
}

/**
 * True if the token is a real chord: parseChord accepts it AND the quality
 * string is built only from known atoms / alterations / a slash bass.
 */
export function isChordish(rawToken: string): boolean {
  const token = normalizeChordToken(rawToken);
  if (token === "" || token.length > 12) return false;

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
    if (NEUTRAL.has(raw.toLowerCase())) continue;
    if (isChordish(raw)) nChord++;
    else nWord++;
  }
  return { nChord, nWord };
}

export function classifyLine(line: OcrLine): LineClass {
  const { nChord, nWord } = countTokens(line);

  if (nChord + nWord === 0) return "blank";

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
