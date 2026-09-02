export type { ChordProDocument, Section, SectionType, Line, Segment } from './types';
export { parse } from './parse';
export { serialize } from './serialize';
export { transposeDocument } from './transposeDocument';
export { toChordsAndLyricsText, toLyricsOnlyText, toNashvilleText, extractChordSequence } from './render';
// Chords-above-lyrics / any positional layout: build on the AST, not on the
// string renderers above. `parse()` -> walk `Section.lines[].segments` (each
// `Segment` is a chord + the lyric run it sits over), or use `toPositionedSections`.
export {
  toPositionedSections,
  type PositionedSection,
  type PositionedLine,
  type ChordCell,
} from './render';
