// Chord grammar per docs/DOMAIN.md §2. Quality string is opaque — transposition
// touches only root and bass, never the quality.

const CHORD_RE = /^([A-G][#b]?)(.*?)(?:\/([A-G][#b]?))?$/;

export interface ParsedChord {
  root: string;
  /** Byte-identical quality string. Never transposed, never inspected beyond opacity. */
  quality: string;
  bass: string | null;
}

export class ChordParseError extends Error {
  constructor(public readonly token: string) {
    super(`Not a valid chord token: "${token}"`);
    this.name = 'ChordParseError';
  }
}

/** Returns null if the token doesn't parse as a chord — an extraction error, not a chord. */
export function parseChord(token: string): ParsedChord | null {
  const match = CHORD_RE.exec(token);
  if (!match) return null;
  const [, root, quality, bass] = match;
  return { root, quality, bass: bass ?? null };
}

export function stringifyChord(chord: ParsedChord): string {
  return chord.bass ? `${chord.root}${chord.quality}/${chord.bass}` : `${chord.root}${chord.quality}`;
}

// ---------------------------------------------------------------------------
// Strict validation
//
// `parseChord` accepts any quality string because transposition doesn't care
// what it is — `parseChord("Gxyz")` succeeds by design. Callers that need to
// know "did a human actually write a chord here" (OCR line classification,
// tap-to-fix-a-chord in the app) use `parseChordStrict` / `isValidChord`
// instead. Keep this the ONE place that answers that question.
// ---------------------------------------------------------------------------

/**
 * A quality string is a compositional grammar, not an enumerated list: any
 * mix of modifier words, extension numbers, and bracketed alterations, in
 * any order and repeatable -- real charts write both `sus4` (modifier then
 * number, the common case) and `7sus4` (number then modifier, a dominant
 * chord with a suspended 4th), plus combined modifiers like `madd9`. Order
 * inside `MODIFIERS` still matters -- longest-first, so `maj`/`min` are
 * checked before the bare `m` that's a prefix of both.
 */
const MODIFIERS = ['maj', 'min', 'dim', 'aug', 'sus', 'add', 'm', '°', 'ø', '+'] as const;

/**
 * Real chord extension numbers only -- 2 and 4 for `sus`/`add` (a triad plus
 * a second/fourth), 5 for a power chord, 6/7/9/11/13 for the standard
 * extensions. Never 1, 3, 8, 10, 12, 14-16: no musician writes those, and
 * accepting them only widens what OCR garbage or a stray lyric word could
 * accidentally validate as, for no real-chord benefit.
 */
const NUMBERS = ['2', '4', '5', '6', '7', '9', '11', '13'] as const;

const ALTERATION_RE = /^[#b](?:5|9|11|13)/;

/**
 * Whether a quality string is built from the grammar above. `qualityIsKnown`
 * is the ONE place that answers "did a human actually write this," so
 * widening it (a new modifier, a new number) changes what validates
 * everywhere in the app -- the ChordPro editor included, not just OCR
 * import.
 */
function qualityIsKnown(quality: string): boolean {
  if (quality.includes('/')) return false; // parseChord already split a real "/bass"; a leftover is junk
  let q = quality;
  let progressed = true;
  while (progressed && q.length > 0) {
    progressed = false;

    const alt = ALTERATION_RE.exec(q);
    if (alt) {
      q = q.slice(alt[0].length);
      progressed = true;
      continue;
    }
    for (const mod of MODIFIERS) {
      if (q.startsWith(mod)) {
        q = q.slice(mod.length);
        progressed = true;
        break;
      }
    }
    if (progressed) continue;
    for (const num of NUMBERS) {
      if (q.startsWith(num)) {
        q = q.slice(num.length);
        progressed = true;
        break;
      }
    }
  }
  return q === '';
}

/**
 * Like `parseChord`, but returns null unless the quality is a chord quality a
 * musician would actually write (docs/DOMAIN.md §2). Use this to decide whether
 * a bracketed token *is* a chord; use `parseChord` when you only need the root
 * and bass to transpose.
 */
export function parseChordStrict(token: string): ParsedChord | null {
  const parsed = parseChord(token);
  if (!parsed || !qualityIsKnown(parsed.quality)) return null;
  return parsed;
}

/** True if `token` is a chord a musician would actually write (docs/DOMAIN.md §2). */
export function isValidChord(token: string): boolean {
  return parseChordStrict(token) !== null;
}
