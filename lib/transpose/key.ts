import { MAJOR_KEY_TABLES, MAJOR_KEY_PC, MINOR_KEY_INFO, type MajorKeyName } from './keyTables';

export interface ResolvedKey {
  raw: string;
  pc: number;
  /** Which key's spelling table to use when rendering notes in this key. */
  tableKey: MajorKeyName;
}

export class UnknownKeyError extends Error {
  constructor(key: string) {
    super(`Unrecognized key "${key}". Expected one of the ~15 usable major/minor keys (see docs/DOMAIN.md §3).`);
    this.name = 'UnknownKeyError';
  }
}

export function resolveKey(key: string): ResolvedKey {
  const trimmed = key.trim();
  const minor = MINOR_KEY_INFO[trimmed];
  if (minor) {
    return { raw: trimmed, pc: minor.pc, tableKey: minor.majorTableKey };
  }
  const major = trimmed as MajorKeyName;
  if (major in MAJOR_KEY_TABLES) {
    return { raw: trimmed, pc: MAJOR_KEY_PC[major], tableKey: major };
  }
  throw new UnknownKeyError(key);
}

function canResolve(key: string): boolean {
  try {
    resolveKey(key);
    return true;
  } catch {
    return false;
  }
}

/** Enharmonic spellings `resolveKey` doesn't accept -> the ones it does. */
const ENHARMONIC_SWAP: Record<string, string> = {
  'A#': 'Bb',
  'D#': 'Eb',
  'G#': 'Ab',
  Cb: 'B',
  'E#': 'F',
  Fb: 'E',
  'B#': 'C',
  Db: 'C#', // only reached for a minor key; Db major resolves directly
  Gb: 'F#', // ditto
};

/**
 * Return a `resolveKey`-able name for `raw` (fixing an enharmonic spelling like
 * `G#` -> `Ab`, `D#m` -> `Ebm`), or null if it isn't a usable key at all. The
 * one place "is this a key name, roughly" is answered — key detection in the
 * importer and any key picker in the app both go through here so they can't give
 * different answers.
 */
export function normalizeKeyName(raw: string): string | null {
  const t = raw.trim();
  if (canResolve(t)) return t;

  const isMinor = /m$/.test(t) && !/maj/i.test(t);
  const root = isMinor ? t.slice(0, -1) : t;
  const alt = ENHARMONIC_SWAP[root];
  if (alt) {
    const cand = isMinor ? `${alt}m` : alt;
    if (canResolve(cand)) return cand;
  }
  return null;
}

/** Spell a pitch class (0-11) as a note name in the given key's table. */
export function spell(pc: number, tableKey: MajorKeyName): string {
  const normalized = ((pc % 12) + 12) % 12;
  return MAJOR_KEY_TABLES[tableKey][normalized];
}
