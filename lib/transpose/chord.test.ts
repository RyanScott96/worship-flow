import { describe, expect, it } from 'vitest';
import { isValidChord, parseChord, parseChordStrict } from './chord';

describe('parseChordStrict / isValidChord', () => {
  it('accepts every chord docs/DOMAIN.md §2 says must parse', () => {
    for (const c of ['G', 'Am', 'C/E', 'F#m7', 'Bbmaj7#11/D', 'Asus4', 'Dm7b5', 'G°']) {
      expect(isValidChord(c), c).toBe(true);
    }
  });

  it('accepts real-world qualities beyond the bare §2 list', () => {
    for (const c of ['Cadd9', 'Gsus', 'Amaj9', 'Dm7b5/Ab', 'F#ø', 'Baug']) {
      expect(isValidChord(c), c).toBe(true);
    }
  });

  it('rejects a lyric word that happens to start with a note letter', () => {
    for (const w of ['Add', 'Every', 'Grace', 'Bass', 'Down', 'Bed', 'Ago']) {
      expect(isValidChord(w), w).toBe(false);
    }
  });

  it('rejects a token parseChord would accept but no musician wrote', () => {
    // parseChord is deliberately permissive; parseChordStrict is not.
    expect(parseChord('Gxyz')).not.toBeNull();
    expect(parseChordStrict('Gxyz')).toBeNull();
    expect(parseChordStrict('C/E/G')).toBeNull();
  });

  it('returns the parsed parts when strict, for callers that want them', () => {
    expect(parseChordStrict('F#m7')).toEqual({ root: 'F#', quality: 'm7', bass: null });
  });
});
