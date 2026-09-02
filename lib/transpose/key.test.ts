import { describe, expect, it } from 'vitest';
import { normalizeKeyName, resolveKey } from './key';

describe('normalizeKeyName', () => {
  it('passes through names resolveKey already accepts', () => {
    for (const k of ['G', 'Bb', 'F#m', 'Ebm', 'C', 'Am']) {
      expect(normalizeKeyName(k)).toBe(k);
    }
  });

  it('swaps an enharmonic spelling resolveKey rejects for it', () => {
    expect(normalizeKeyName('A#')).toBe('Bb'); // A# major
    expect(normalizeKeyName('D#')).toBe('Eb'); // D# major
    expect(normalizeKeyName('Dbm')).toBe('C#m'); // Db major resolves; Db minor doesn't
  });

  it('returns null for something that is not a key', () => {
    expect(normalizeKeyName('H')).toBeNull();
    expect(normalizeKeyName('G7')).toBeNull();
  });

  it('every non-null result actually resolves', () => {
    for (const raw of ['A#', 'Dbm', 'Bb', 'F#m', 'Ab', 'Ebm', 'C']) {
      const k = normalizeKeyName(raw);
      expect(k, raw).not.toBeNull();
      expect(() => resolveKey(k as string)).not.toThrow();
    }
  });
});
