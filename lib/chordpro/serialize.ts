import type { ChordProDocument, Segment } from './types';

const META_ORDER = ['title', 'subtitle', 'key', 'tempo', 'time', 'capo'];

function serializeLyricLine(segments: Segment[]): string {
  return segments.map((seg) => (seg.chord !== null ? `[${seg.chord}]${seg.lyric}` : seg.lyric)).join('');
}

/** Canonical ChordPro text for a document — always the long directive form (docs/DOMAIN.md §1). */
export function serialize(doc: ChordProDocument): string {
  const lines: string[] = [];

  for (const name of META_ORDER) {
    if (name in doc.directives) lines.push(`{${name}: ${doc.directives[name]}}`);
  }
  for (const [name, value] of Object.entries(doc.directives)) {
    if (META_ORDER.includes(name)) continue;
    lines.push(`{${name}: ${value}}`);
  }
  if (Object.keys(doc.directives).length > 0 && doc.sections.length > 0) lines.push('');

  doc.sections.forEach((section, idx) => {
    if (idx > 0) lines.push('');
    if (section.type) {
      const startName = `start_of_${section.type}`;
      lines.push(section.label ? `{${startName}: ${section.label}}` : `{${startName}}`);
    }
    for (const line of section.lines) {
      lines.push(line.kind === 'comment' ? `{comment: ${line.text}}` : serializeLyricLine(line.segments));
    }
    if (section.type) lines.push(`{end_of_${section.type}}`);
  });

  return lines.join('\n');
}
