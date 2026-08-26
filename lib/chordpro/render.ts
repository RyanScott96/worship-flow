import { toNashvilleNumber } from '../transpose';
import type { ChordProDocument, Segment } from './types';

function renderLine(segments: Segment[], transformChord: (chord: string) => string | null): string {
  return segments
    .map((seg) => {
      if (seg.chord === null) return seg.lyric;
      const transformed = transformChord(seg.chord);
      return transformed === null ? seg.lyric : `[${transformed}]${seg.lyric}`;
    })
    .join('');
}

function renderDocument(doc: ChordProDocument, transformChord: (chord: string) => string | null): string {
  const lines: string[] = [];
  doc.sections.forEach((section, idx) => {
    if (idx > 0) lines.push('');
    for (const line of section.lines) {
      lines.push(line.kind === 'comment' ? `# ${line.text}` : renderLine(line.segments, transformChord));
    }
  });
  return lines.join('\n');
}

/** Chords + lyrics inline (the guitar view) — chords rendered as-is. */
export function toChordsAndLyricsText(doc: ChordProDocument): string {
  return renderDocument(doc, (chord) => chord);
}

/** Lyrics only, chords stripped (the vocalist view). */
export function toLyricsOnlyText(doc: ChordProDocument): string {
  return renderDocument(doc, () => null);
}

/** Chords replaced with Nashville numerals relative to `key` (default: the document's own key). */
export function toNashvilleText(doc: ChordProDocument, key: string = doc.directives.key): string {
  if (!key) throw new Error('Cannot render Nashville numbers without a key.');
  return renderDocument(doc, (chord) => toNashvilleNumber(chord, key));
}

/** Ordered chord tokens as they appear, lyrics dropped (the rhythm-section view). */
export function extractChordSequence(doc: ChordProDocument): string[] {
  const out: string[] = [];
  for (const section of doc.sections) {
    for (const line of section.lines) {
      if (line.kind !== 'lyric') continue;
      for (const seg of line.segments) if (seg.chord) out.push(seg.chord);
    }
  }
  return out;
}
