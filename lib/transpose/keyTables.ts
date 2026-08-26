// Static per-key chromatic spelling tables. Generated once from music theory
// (order of sharps/flats, submediant for relative minors) and hand-verified
// against docs/DOMAIN.md §3's required test cases — not computed at runtime.
// See docs/DOMAIN.md §3 before touching this file.

export type MajorKeyName =
  | 'C' | 'G' | 'D' | 'A' | 'E' | 'B' | 'F#' | 'C#'
  | 'F' | 'Bb' | 'Eb' | 'Ab' | 'Db' | 'Gb' | 'Cb';

export const SHARP_KEYS: readonly MajorKeyName[] = ['G', 'D', 'A', 'E', 'B', 'F#', 'C#'];
export const FLAT_KEYS: readonly MajorKeyName[] = ['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'];

// C has no accidentals; treated as sharp-leaning by convention (DOMAIN.md §3).
export function isSharpLeaning(key: MajorKeyName): boolean {
  return key === 'C' || SHARP_KEYS.includes(key);
}

/** Pitch class (0-11, C=0) of each major key's tonic. */
export const MAJOR_KEY_PC: Record<MajorKeyName, number> = {
  C: 0, G: 7, D: 2, A: 9, E: 4, B: 11, 'F#': 6, 'C#': 1,
  F: 5, Bb: 10, Eb: 3, Ab: 8, Db: 1, Gb: 6, Cb: 11,
};

/**
 * pitch class -> note name, one 12-slot table per major key.
 * Every key defaults to the generic sharp/flat chromatic scale; only the
 * extreme keys (F#, C#, Gb, Cb) override slots where their true diatonic
 * spelling differs (e.g. F# major's 7th degree is E#, not F).
 */
export const MAJOR_KEY_TABLES: Record<MajorKeyName, readonly string[]> = {
  C:  ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
  G:  ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
  D:  ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
  A:  ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
  E:  ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
  B:  ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
  'F#': ['C', 'C#', 'D', 'D#', 'E', 'E#', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
  'C#': ['B#', 'C#', 'D', 'D#', 'E', 'E#', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
  F:  ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'],
  Bb: ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'],
  Eb: ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'],
  Ab: ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'],
  Db: ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'],
  Gb: ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'Cb'],
  Cb: ['C', 'Db', 'D', 'Eb', 'Fb', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'Cb'],
};

/** Relative-minor key name -> the major key whose table it borrows, and its own tonic pitch class. */
export const MINOR_KEY_INFO: Record<string, { majorTableKey: MajorKeyName; pc: number }> = {
  Am: { majorTableKey: 'C', pc: 9 },
  Em: { majorTableKey: 'G', pc: 4 },
  Bm: { majorTableKey: 'D', pc: 11 },
  'F#m': { majorTableKey: 'A', pc: 6 },
  'C#m': { majorTableKey: 'E', pc: 1 },
  'G#m': { majorTableKey: 'B', pc: 8 },
  'D#m': { majorTableKey: 'F#', pc: 3 },
  'Ebm': { majorTableKey: 'Gb', pc: 3 },
  'A#m': { majorTableKey: 'C#', pc: 10 },
  'Bbm': { majorTableKey: 'Db', pc: 10 },
  Dm: { majorTableKey: 'F', pc: 2 },
  Gm: { majorTableKey: 'Bb', pc: 7 },
  Cm: { majorTableKey: 'Eb', pc: 0 },
  Fm: { majorTableKey: 'Ab', pc: 5 },
  'Abm': { majorTableKey: 'Cb', pc: 8 },
};
