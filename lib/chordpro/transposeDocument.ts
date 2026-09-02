import { ChordParseError, resolveKey, transposeChordToken } from '../transpose';
import type { ChordProDocument } from './types';

/**
 * Transpose every chord in a document from its `{key}` directive to `toKey`.
 * Pure — no I/O.
 *
 * A bracket that isn't a pitched chord (`[N.C.]`, `[x2]`, or an OCR glitch the
 * digitizer emitted on purpose, D-16) is passed through byte-identical rather
 * than failing the whole document — one such token must not blank a chart in a
 * setlist the moment it gets a key override (D-02, D-06). Only an unusable
 * `{key}` / `toKey` throws.
 */
export function transposeDocument(doc: ChordProDocument, toKey: string): ChordProDocument {
  const fromKey = doc.directives.key;
  if (!fromKey) {
    throw new Error('Cannot transpose a ChordPro document with no {key} directive.');
  }
  resolveKey(fromKey); // fail loud, once, on a bad key rather than per-token
  resolveKey(toKey);

  const sections = doc.sections.map((section) => ({
    ...section,
    lines: section.lines.map((line) =>
      line.kind === 'lyric'
        ? {
            kind: 'lyric' as const,
            segments: line.segments.map((seg) => {
              if (!seg.chord) return seg;
              try {
                return { ...seg, chord: transposeChordToken(seg.chord, fromKey, toKey) };
              } catch (err) {
                if (err instanceof ChordParseError) return seg; // not a pitched token — leave it
                throw err;
              }
            }),
          }
        : line
    ),
  }));

  return { directives: { ...doc.directives, key: toKey }, sections };
}
