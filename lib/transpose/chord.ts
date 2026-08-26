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
