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
 * Known chord-quality atoms, longest-first so `maj7` is peeled before `maj`.
 * The docs/DOMAIN.md §2 set, plus `maj9/11/13`, bare `sus`, and `add/add11/add13`
 * — all seen on real charts.
 */
const QUALITY_ATOMS = [
  'maj13', 'maj11', 'maj9', 'maj7', 'maj',
  'min', 'dim', 'aug',
  'sus2', 'sus4', 'sus',
  'add9', 'add11', 'add13', 'add',
  '6', '7', '9', '11', '13',
  'm', '°', 'ø', '+',
] as const;

const ALTERATION_RE = /^[#b](?:5|9|11|13)/;

/** Whether a quality string is built only from known atoms and alterations. */
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
    for (const atom of QUALITY_ATOMS) {
      if (q.startsWith(atom)) {
        q = q.slice(atom.length);
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
