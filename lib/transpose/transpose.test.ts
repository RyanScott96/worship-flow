import { describe, expect, it } from 'vitest';
import { parseChord, stringifyChord } from './chord';
import { transposeChordToken, ChordParseError } from './transpose';
import {
  shapeKeyForCapo,
  soundingKeyForCapo,
  formatCapoLabel,
  capoIsSet,
} from './capo';
import { toNashvilleNumber } from './nashville';
import { UnknownKeyError } from './key';

describe('parseChord', () => {
  const cases: [string, { root: string; quality: string; bass: string | null }][] = [
    ['G', { root: 'G', quality: '', bass: null }],
    ['Am', { root: 'A', quality: 'm', bass: null }],
    ['C/E', { root: 'C', quality: '', bass: 'E' }],
    ['F#m7', { root: 'F#', quality: 'm7', bass: null }],
    ['Bbmaj7#11/D', { root: 'Bb', quality: 'maj7#11', bass: 'D' }],
    ['Asus4', { root: 'A', quality: 'sus4', bass: null }],
    ['Dm7b5', { root: 'D', quality: 'm7b5', bass: null }],
    ['G°', { root: 'G', quality: '°', bass: null }],
  ];

  it.each(cases)('parses %s', (token, expected) => {
    expect(parseChord(token)).toEqual(expected);
  });

  it('round-trips through stringifyChord', () => {
    for (const [token] of cases) {
      const parsed = parseChord(token);
      expect(stringifyChord(parsed!)).toBe(token);
    }
  });

  it('rejects garbage tokens', () => {
    expect(parseChord('Hmaj7')).toBeNull();
    expect(parseChord('')).toBeNull();
  });
});

describe('transposeChordToken — required cases (DOMAIN.md §3)', () => {
  const cases: [string, string, string, string][] = [
    ['C', 'Db', 'F', 'Gb'],
    ['C', 'D', 'F', 'G'],
    ['A', 'Bb', 'A', 'Bb'],
    ['G', 'Ab', 'B', 'C'],
    ['C', 'B', 'F', 'E'],
    ['Eb', 'E', 'Ab', 'A'],
    ['C', 'F#', 'C', 'F#'],
  ];

  it.each(cases)('%s -> %s: %s becomes %s', (from, to, input, expected) => {
    expect(transposeChordToken(input, from, to)).toBe(expected);
  });
});

describe('transposeChordToken — quality and slash bass', () => {
  it('leaves quality string byte-identical', () => {
    expect(transposeChordToken('Am7b5', 'C', 'D')).toBe('Bm7b5');
    expect(transposeChordToken('Fmaj7#11', 'C', 'G')).toBe('Cmaj7#11');
  });

  it('transposes slash bass with the root: [G/B] in G -> D/F#', () => {
    expect(transposeChordToken('G/B', 'G', 'D')).toBe('D/F#');
  });

  it('is idempotent transposing to the same key', () => {
    expect(transposeChordToken('Bbmaj7/D', 'Eb', 'Eb')).toBe('Bbmaj7/D');
  });

  it('handles minor keys via their relative major table', () => {
    // Am -> C's table; transposing within Am should still spell diatonically.
    expect(transposeChordToken('Dm', 'Am', 'Em')).toBe('Am');
  });

  it('throws ChordParseError on unparseable tokens', () => {
    expect(() => transposeChordToken('Hmaj7', 'C', 'D')).toThrow(ChordParseError);
  });

  it('throws UnknownKeyError on unrecognized keys', () => {
    expect(() => transposeChordToken('C', 'Xb', 'D')).toThrow(UnknownKeyError);
  });
});

describe('capo math (DOMAIN.md §4)', () => {
  it('capo 3 on a chart sounding in Bb displays G shapes', () => {
    expect(shapeKeyForCapo('Bb', 3)).toBe('G');
  });

  it('is the inverse of soundingKeyForCapo', () => {
    expect(soundingKeyForCapo('G', 3)).toBe('Bb');
  });

  it('formats the required label', () => {
    expect(formatCapoLabel('Bb', 3)).toBe('Capo 3 · play in G · sounds in Bb');
  });

  it('formats capo 0 as just the key', () => {
    expect(formatCapoLabel('G', 0)).toBe('Play in G');
  });

  it('capoIsSet treats only a positive fret as a capo', () => {
    expect(capoIsSet(3)).toBe(true);
    expect(capoIsSet(0)).toBe(false);
    expect(capoIsSet(null)).toBe(false);
    expect(capoIsSet(undefined)).toBe(false);
  });
});

describe('toNashvilleNumber (DOMAIN.md §5)', () => {
  it('renders the diatonic degrees of C major', () => {
    expect(toNashvilleNumber('C', 'C')).toBe('I');
    expect(toNashvilleNumber('Dm', 'C')).toBe('ii');
    expect(toNashvilleNumber('Em', 'C')).toBe('iii');
    expect(toNashvilleNumber('F', 'C')).toBe('IV');
    expect(toNashvilleNumber('G', 'C')).toBe('V');
    expect(toNashvilleNumber('Am', 'C')).toBe('vi');
    expect(toNashvilleNumber('Bdim', 'C')).toBe('vii°');
  });

  it('keeps extensions after stripping the redundant minor marker', () => {
    expect(toNashvilleNumber('Em7', 'C')).toBe('iii7');
    expect(toNashvilleNumber('G7', 'C')).toBe('V7');
  });

  it('marks borrowed/chromatic chords with an accidental prefix', () => {
    expect(toNashvilleNumber('Bb', 'C')).toBe('bVII');
  });

  it('renders slash bass as a scale-degree fraction', () => {
    expect(toNashvilleNumber('G/B', 'G')).toBe('I/iii');
  });
});
