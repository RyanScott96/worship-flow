export type SectionType = 'verse' | 'chorus' | 'bridge' | null;

export interface Segment {
  /** Raw chord token, e.g. "G/B". Null for the leading lyric fragment of a line. */
  chord: string | null;
  lyric: string;
}

export type Line =
  | { kind: 'lyric'; segments: Segment[] }
  | { kind: 'comment'; text: string };

export interface Section {
  type: SectionType;
  /** e.g. "Verse 1" from {start_of_verse: Verse 1}. Null if untitled or no wrapping directive. */
  label: string | null;
  lines: Line[];
}

export interface ChordProDocument {
  /** title, subtitle, key, tempo, time, capo, and any other {name: value} directives. */
  directives: Record<string, string>;
  sections: Section[];
}
