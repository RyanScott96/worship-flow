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

/** Spell a pitch class (0-11) as a note name in the given key's table. */
export function spell(pc: number, tableKey: MajorKeyName): string {
  const normalized = ((pc % 12) + 12) % 12;
  return MAJOR_KEY_TABLES[tableKey][normalized];
}
