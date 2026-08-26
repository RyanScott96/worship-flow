import { ChordParseError, parseChord, stringifyChord } from './chord';
import { resolveKey, spell } from './key';
import { noteToPitchClass } from './notes';

export { ChordParseError };

/**
 * Transpose a single chord token from one key to another.
 * Root and bass are shifted and re-spelled for the target key; the quality
 * string is carried over byte-identical (DOMAIN.md §2 — the "Am -> Bm" bug).
 */
export function transposeChordToken(token: string, fromKey: string, toKey: string): string {
  const chord = parseChord(token);
  if (!chord) throw new ChordParseError(token);

  const from = resolveKey(fromKey);
  const to = resolveKey(toKey);
  const delta = to.pc - from.pc;

  const newRoot = spell(noteToPitchClass(chord.root) + delta, to.tableKey);
  const newBass = chord.bass ? spell(noteToPitchClass(chord.bass) + delta, to.tableKey) : null;

  return stringifyChord({ root: newRoot, quality: chord.quality, bass: newBass });
}
