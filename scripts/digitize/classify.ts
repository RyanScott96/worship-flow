// Classify each OCR line as chord / lyric / section-label / blank.
// The chord test is `lib/transpose`'s `isValidChord` (strict quality check, so
// lyric words like "Add" / "Every" don't register), wrapped here with the
// OCR-only guards it shouldn't carry: punctuation stripping, the 7->T / leading-O
// repairs, the length cap, and the fret-tablature exclusion.

import { isValidChord } from "../../lib/transpose";
import type { LineClass, OcrLine } from "./types";

/**
 * Section-label line, e.g. "Verse 1", "CHORUS", "Bridge", "Pre-Chorus:",
 * "[Intro]". Tolerates a bracketed label with both "[" and "]" (a very
 * common printed convention) as well as a trailing "]" with no matching "["
 * -- a printed "[Verse 1]" whose opening bracket fell off the left edge of a
 * scan (a real pilot-batch failure: the original page's left margin got
 * clipped) still reads as "Verse 1]" and should become a section directive,
 * not get stuck in the lyric/chord stream as literal text.
 */
export const SECTION_LABEL_RE =
  /^\s*\[?\s*(?:\d+\s*[.)-]?\s*)?(verse|chorus|bridge|intro|outro|tag|refrain|ending|pre[-\s]?chorus|interlude|vamp|instrumental|coda)\b\s*\d*\s*[:.)\]-]?\s*$/i;

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
 * as T (`A7` -> `AT`), a stray leading O (`OD` -> `D`), an isolated bold "C"
 * hallucinating extra characters around itself -- a trailing lowercase "c"
 * (`Cc` -> `C`), lowercase outright (`c` -> `C`), or a phantom leading "G"
 * (`GC` -> `C`) -- a slash chord's "/" read as a capital "I" (`D/F#` ->
 * `DIFf`), a printed "♯" landing as a trailing "f"/"¥" wherever it appears
 * (`F#` -> `Ff`, with or without the "/" misread too), and `sus4` hallucinating
 * a trailing "d" (`Gsus4d` -> `Gsus4`, confirmed on two independent scans).
 * The literal-string cases (`Cc`/`c`/`GC`) are exact-string matches, not a
 * general "case doesn't matter" or "letters can appear/disappear around a
 * root" rule -- a genuine `Bb` (B-flat) or `Gm7` must never be touched, and
 * this can't: `C` and `c` are the same glyph at two scales (a single-
 * character OCR "word" has no neighbouring text to anchor which scale it's
 * reading), which is why only `C` -- not `B`, `D`, `G`... -- shows this
 * failure in the pilot batch: no other chord letter's lowercase form is
 * shape-identical to its uppercase one. Applied only where a token is
 * already in chord position.
 */
export function fixChordOcr(token: string): string {
  if (token === "Cc" || token === "c" || token === "GC") return "C";
  return token
    .replace(/sus4d$/, "sus4")
    .replace(/^O([A-G])/, "$1")
    .replace(/^([A-G][#b]?)T\b/, "$17")
    .replace(/^([A-G][#b]?)I([A-G])[f¥]$/, "$1/$2#")
    .replace(/^([A-G][#b]?)I([A-G][#b]?)$/, "$1/$2")
    .replace(/([A-G])[f¥]$/, "$1#");
}

/** A lone "|" in a lyric line is almost always a mis-OCR'd "I". */
export function fixLyricWord(word: string): string {
  return word === "|" ? "I" : word;
}

/**
 * A capo "shape(sounding)" token, e.g. `B(G)` -- finger a B shape, capo makes
 * it sound G. Common printed convention (Nashville-style / worship chart
 * software) for a chart written for a capo'd guitar. The stored ChordPro
 * chord has to be the SOUNDING chord: capo is a per-service, per-player
 * display choice (docs/DOMAIN.md §4), never baked into the chart, so the
 * printed shape is discarded here, not preserved.
 *
 * Requires a non-empty prefix before the "(" so a chord already wrapped in
 * its own parens, e.g. "(Em)", isn't mistaken for one -- that's
 * `normalizeChordToken`'s job, not this. The sounding side gets the same
 * `fixChordOcr` repairs as any other chord token (its trailing "♯ misread
 * as f/¥" rule is what recovers e.g. "D/F¥" -> "D/F#" here), rather than a
 * second copy of that repair private to this function.
 */
export function capoShapeSounding(rawToken: string): string | null {
  const m = /^[A-G][^()]*\(([^()]+)\)$/.exec(rawToken);
  if (!m) return null;
  const sounding = fixChordOcr(normalizeChordToken(m[1]));
  return isValidChord(sounding) ? sounding : null;
}

/** The chord text a token should render as once OCR noise and any capo
 *  shape/sounding notation (see `capoShapeSounding`) are resolved. */
export function resolveChordToken(rawToken: string): string {
  return capoShapeSounding(rawToken) ?? fixChordOcr(normalizeChordToken(rawToken));
}

/**
 * A hyphen-joined pair of chords with no space around the hyphen, e.g.
 * `D-A` -- shorthand some charts print for "D then A" (a quick walk-up/
 * turnaround), which OCR keeps as one Tesseract word since there's no gap
 * to split on. Not a slash chord: `D/A` already parses as one valid chord
 * (D with an A bass) and never reaches this. Requires the hyphen to have a
 * real chord on *both* sides -- a token that only looks similar, like a
 * genuine unparseable mess with a dash in it, is left alone.
 */
export function splitHyphenChordPair(rawToken: string): [string, string] | null {
  const idx = rawToken.indexOf("-");
  if (idx <= 0 || idx >= rawToken.length - 1) return null;
  const left = resolveChordToken(rawToken.slice(0, idx));
  const right = resolveChordToken(rawToken.slice(idx + 1));
  if (!isValidChord(left) || !isValidChord(right)) return null;
  return [left, right];
}

/**
 * True if the token is a real chord once the OCR noise is stripped: known
 * quality atoms only (`lib/transpose` `isValidChord`), not a fret-tab row, not
 * absurdly long.
 */
export function isChordish(rawToken: string): boolean {
  if (capoShapeSounding(rawToken) != null) return true;
  if (splitHyphenChordPair(rawToken) != null) return true;
  const token = fixChordOcr(normalizeChordToken(rawToken));
  if (token === "" || token.length > 12) return false;
  if (FRET_TAB_RE.test(token)) return false;
  return isValidChord(token);
}

/**
 * The bracketed ChordPro text for one OCR "word" already known to be
 * chordish (see `isChordish`) -- almost always one chord, `[G]`, but a
 * hyphen-joined pair (see `splitHyphenChordPair`) becomes two: `[D][A]`.
 */
export function renderChordMark(rawToken: string): string {
  const pair = splitHyphenChordPair(rawToken);
  if (pair) return `[${pair[0]}][${pair[1]}]`;
  return `[${resolveChordToken(rawToken)}]`;
}

/**
 * All chord(s) a token resolves to, in reading order -- almost always one,
 * but two for a hyphen-joined pair. For a caller that wants the underlying
 * chords themselves (e.g. key detection), not display/bracket text.
 */
export function resolvedChordTokens(rawToken: string): string[] {
  const pair = splitHyphenChordPair(rawToken);
  return pair ? [...pair] : [resolveChordToken(rawToken)];
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
