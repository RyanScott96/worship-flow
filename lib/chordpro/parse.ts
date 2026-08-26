import { canonicalDirectiveName, SECTION_START, SECTION_END } from './directives';
import type { ChordProDocument, Section, Segment } from './types';

const DIRECTIVE_RE = /^\{([a-zA-Z_]+)(?::\s*(.*))?\}$/;
const CHORD_MARKER_RE = /(\[[^\]]*\])/;

function parseLyricLine(line: string): Segment[] {
  if (line === '') return [{ chord: null, lyric: '' }];

  const parts = line.split(CHORD_MARKER_RE);
  const segments: Segment[] = [];
  let pendingChord: string | null = null;

  parts.forEach((part, i) => {
    const chordMatch = /^\[([^\]]*)\]$/.exec(part);
    if (chordMatch) {
      pendingChord = chordMatch[1];
      return;
    }
    // Artifact of split() when the line starts with a chord marker.
    if (part === '' && i === 0) return;
    segments.push({ chord: pendingChord, lyric: part });
    pendingChord = null;
  });

  return segments;
}

/** Parse ChordPro source into a document. Only text inside [...] is ever treated as a chord. */
export function parse(source: string): ChordProDocument {
  const directives: Record<string, string> = {};
  const sections: Section[] = [];
  let current: Section | null = null;

  function ensureSection(): Section {
    if (!current) current = { type: null, label: null, lines: [] };
    return current;
  }

  function closeSection() {
    if (current) {
      sections.push(current);
      current = null;
    }
  }

  for (const rawLine of source.split(/\r\n|\r|\n/)) {
    const line = rawLine.trimEnd();
    const directiveMatch = DIRECTIVE_RE.exec(line.trim());

    if (directiveMatch) {
      const name = canonicalDirectiveName(directiveMatch[1]);
      const value = directiveMatch[2] ?? '';

      if (name in SECTION_START) {
        closeSection(); // lenient: an unclosed section auto-closes when the next one opens
        current = { type: SECTION_START[name], label: value || null, lines: [] };
        continue;
      }
      if (name in SECTION_END) {
        closeSection();
        continue;
      }
      if (name === 'comment') {
        ensureSection().lines.push({ kind: 'comment', text: value });
        continue;
      }
      directives[name] = value;
      continue;
    }

    // Blank line outside any section is document whitespace, not content.
    if (line === '' && !current) continue;

    ensureSection().lines.push({ kind: 'lyric', segments: parseLyricLine(line) });
  }
  closeSection();

  return { directives, sections };
}
