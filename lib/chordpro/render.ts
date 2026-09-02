import { ChordParseError, toNashvilleNumber } from '../transpose';
import type { ChordProDocument, Section, SectionType, Segment } from './types';

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

/**
 * Chords replaced with Nashville numerals relative to `key` (default: the
 * document's own key). A bracket that isn't a pitched chord is left as written
 * rather than failing the whole render — same tolerance as `transposeDocument`.
 */
export function toNashvilleText(doc: ChordProDocument, key: string = doc.directives.key): string {
  if (!key) throw new Error('Cannot render Nashville numbers without a key.');
  return renderDocument(doc, (chord) => {
    try {
      return toNashvilleNumber(chord, key);
    } catch (err) {
      if (err instanceof ChordParseError) return chord;
      throw err;
    }
  });
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

// ---------------------------------------------------------------------------
// Positioned view (chords above lyrics) — the structure the D-18 viewer and the
// print path consume. This is the AST-level surface: it walks `Segment`s, it
// does NOT re-parse rendered `[G]` strings.
// ---------------------------------------------------------------------------

/** A chord slot and the lyric run beneath it. `chord: ''` means plain lyric, nothing above it. */
export interface ChordCell {
  chord: string;
  lyric: string;
}

export type PositionedLine =
  | { kind: 'lyric'; cells: ChordCell[] }
  | { kind: 'comment'; text: string };

export interface PositionedSection {
  type: SectionType;
  label: string | null;
  lines: PositionedLine[];
}

/**
 * The document as chord/lyric cells the caller lays out with each chord sitting
 * over its lyric run (docs/DECISIONS.md D-18). Mirrors `doc.sections` 1:1.
 *
 * Same transform contract as the string renderers: `transformChord` returns null
 * to drop a chord (a non-diatonic token in Nashville, say), or is omitted for
 * as-written. Compose it with `transposeDocument` upstream for a transposed view.
 */
export function toPositionedSections(
  doc: ChordProDocument,
  transformChord: (chord: string) => string | null = (c) => c,
): PositionedSection[] {
  return doc.sections.map((section: Section) => ({
    type: section.type,
    label: section.label,
    lines: section.lines.map((line): PositionedLine => {
      if (line.kind === 'comment') return { kind: 'comment', text: line.text };
      const cells = line.segments.map((seg): ChordCell => ({
        chord: seg.chord === null ? '' : (transformChord(seg.chord) ?? ''),
        lyric: seg.lyric,
      }));
      return { kind: 'lyric', cells };
    }),
  }));
}
