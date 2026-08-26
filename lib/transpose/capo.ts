import { resolveKey } from './key';
import type { MajorKeyName } from './keyTables';

// Preferred spelling for each pitch class when naming a capo'd "shape" key —
// the convention guitarists' capo charts use (DOMAIN.md §4).
const PC_TO_SHAPE_KEY: readonly MajorKeyName[] = [
  'C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B',
];

/** The chord shapes a guitarist plays with a given capo fret to sound in `soundingKey`. */
export function shapeKeyForCapo(soundingKey: string, capoFret: number): string {
  const { pc } = resolveKey(soundingKey);
  return PC_TO_SHAPE_KEY[(((pc - capoFret) % 12) + 12) % 12];
}

/** The key that sounds when playing `shapeKey` shapes with a given capo fret. */
export function soundingKeyForCapo(shapeKey: string, capoFret: number): string {
  const { pc } = resolveKey(shapeKey);
  return PC_TO_SHAPE_KEY[((pc + capoFret) % 12 + 12) % 12];
}

/** "Capo 3 · play in G · sounds in Bb" — always show both (DOMAIN.md §4). */
export function formatCapoLabel(soundingKey: string, capoFret: number): string {
  if (capoFret <= 0) return `Play in ${soundingKey}`;
  const shapeKey = shapeKeyForCapo(soundingKey, capoFret);
  return `Capo ${capoFret} · play in ${shapeKey} · sounds in ${soundingKey}`;
}
