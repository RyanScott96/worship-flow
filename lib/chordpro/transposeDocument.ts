import { transposeChordToken } from '../transpose';
import type { ChordProDocument } from './types';

/** Transpose every chord in a document from its {key} directive to `toKey`. Pure — no I/O. */
export function transposeDocument(doc: ChordProDocument, toKey: string): ChordProDocument {
  const fromKey = doc.directives.key;
  if (!fromKey) {
    throw new Error('Cannot transpose a ChordPro document with no {key} directive.');
  }

  const sections = doc.sections.map((section) => ({
    ...section,
    lines: section.lines.map((line) =>
      line.kind === 'lyric'
        ? {
            kind: 'lyric' as const,
            segments: line.segments.map((seg) =>
              seg.chord ? { ...seg, chord: transposeChordToken(seg.chord, fromKey, toKey) } : seg
            ),
          }
        : line
    ),
  }));

  return { directives: { ...doc.directives, key: toKey }, sections };
}
