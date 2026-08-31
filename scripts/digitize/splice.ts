// The whole trick (docs/DOMAIN.md §7 step 3): put each chord token's x-center
// against the lyric line beneath it, find the character at that x, and splice
// `[Chord]` in at that index. Work from word boxes, never flattened text.

import { isChordish, isNeutralToken, normalizeChordToken } from "./classify";
import type { OcrLine, OcrWord } from "./types";

interface CharX {
  lo: number;
  hi: number;
  centre: number;
}

/**
 * One x-interval per character of `lyricStr` (= words joined by single spaces),
 * plus a virtual slot at `lyricStr.length` for trailing chords. Within a word,
 * characters are spaced evenly across the word box (the monospace approximation
 * documented in the README).
 */
function buildCharX(words: OcrWord[]): { lyricStr: string; charX: CharX[] } {
  const lyricStr = words.map((w) => w.text).join(" ");
  const charX: CharX[] = [];

  for (let wi = 0; wi < words.length; wi++) {
    const w = words[wi];
    const len = Math.max(w.text.length, 1);
    for (let k = 0; k < w.text.length; k++) {
      const lo = w.left + (k / len) * w.width;
      const hi = w.left + ((k + 1) / len) * w.width;
      charX.push({ lo, hi, centre: (lo + hi) / 2 });
    }
    if (wi < words.length - 1) {
      const lo = w.left + w.width;
      const hi = Math.max(words[wi + 1].left, lo);
      charX.push({ lo, hi, centre: (lo + hi) / 2 });
    }
  }

  const last = words[words.length - 1];
  const endX = last.left + last.width;
  charX.push({ lo: endX, hi: endX, centre: endX });

  return { lyricStr, charX };
}

/** Resolve a chord's x-center to an insertion index in `lyricStr`. */
function resolveIndex(cx: number, lyricStr: string, charX: CharX[]): number {
  if (cx < charX[0].lo) return 0; // clamp to start
  if (cx > charX[charX.length - 1].hi) return lyricStr.length; // clamp to end

  let bestK = 0;
  let bestDist = Infinity;
  for (let k = 0; k < charX.length; k++) {
    const dist = Math.abs(charX[k].centre - cx);
    // `<=` so an exact tie resolves to the later index — the chord belongs to
    // the syllable it precedes (docs/DOMAIN.md §1).
    if (dist <= bestDist) {
      bestDist = dist;
      bestK = k;
    }
  }

  // Landing on the inter-word space -> nudge onto the start of the next word.
  if (bestK < lyricStr.length && lyricStr[bestK] === " ") bestK += 1;
  return bestK;
}

export interface SpliceResult {
  /** ChordPro line: `[G]Amaz[G/B]ing grace`, or `[C][G][Am]` for a chord-only line. */
  text: string;
  /**
   * Bracketed tokens that don't parse as chords — kept in the output (so the
   * error sits next to the scan for inline correction, D-05/D-06) and reported
   * here for the validators / report.
   */
  nonChordTokens: string[];
}

/**
 * Splice the chord line's tokens into the lyric line by x-position.
 * Pass `lyricLine = null` (or an empty lyric) for an instrumental / turnaround
 * row — the chords are emitted back-to-back with no lyric.
 *
 * Every non-neutral token is bracketed, even one that doesn't parse — a wrong
 * `[D5o]` is easier to spot and fix at practice than a silently missing chord.
 */
export function spliceChordsIntoLyric(
  chordLine: OcrLine,
  lyricLine: OcrLine | null,
): SpliceResult {
  const tokenOf = (w: OcrWord) => normalizeChordToken(w.text);
  const marks: OcrWord[] = chordLine.words.filter((w) => !isNeutralToken(w.text));
  const nonChordTokens = marks
    .filter((w) => !isChordish(w.text))
    .map((w) => tokenOf(w));

  const lyricWords = lyricLine ? lyricLine.words : [];
  const haveLyric = lyricWords.length > 0 && lyricWords.some((w) => w.text !== "");

  if (!haveLyric) {
    // Instrumental line: keep bar lines / repeats as literal text between chords.
    const parts: string[] = [];
    for (const w of chordLine.words) {
      if (isNeutralToken(w.text)) parts.push(w.text);
      else parts.push(`[${tokenOf(w)}]`);
    }
    return { text: parts.join(" ").replace(/\] \[/g, "]["), nonChordTokens };
  }

  const { lyricStr, charX } = buildCharX(lyricWords);

  // marks are already left-sorted (OcrLine.words is); keep that order so two
  // tokens resolving to the same index come out `[A][B]` in source order.
  const inserts = new Map<number, string[]>();
  for (const w of marks) {
    const cx = w.left + w.width / 2;
    const idx = resolveIndex(cx, lyricStr, charX);
    const bucket = inserts.get(idx);
    if (bucket) bucket.push(`[${tokenOf(w)}]`);
    else inserts.set(idx, [`[${tokenOf(w)}]`]);
  }

  let out = "";
  for (let i = 0; i <= lyricStr.length; i++) {
    const bucket = inserts.get(i);
    if (bucket) out += bucket.join("");
    if (i < lyricStr.length) out += lyricStr[i];
  }
  return { text: out, nonChordTokens };
}
