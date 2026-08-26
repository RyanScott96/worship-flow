import { ChordParseError, parseChord } from './chord';
import { resolveKey } from './key';
import { noteToPitchClass } from './notes';

// Roman numeral per pitch-class offset from the key's tonic. Diatonic degrees
// (0,2,4,5,7,9,11) carry the case DOMAIN.md §5 specifies; chromatic passing
// degrees (1,3,6,8,10) are written as the flat/sharp of the nearest diatonic
// degree, uppercase, per common Nashville Number System convention for
// borrowed chords (bIII, bVI, bVII show up constantly in worship music).
const NUMERAL: readonly string[] = [
  'I', 'bII', 'ii', 'bIII', 'iii', 'IV', '#IV', 'V', 'bVI', 'vi', 'bVII', 'vii°',
];
const DEFAULT_QUALITY: readonly ('major' | 'minor' | 'dim')[] = [
  'major', 'major', 'minor', 'major', 'minor', 'major', 'major', 'major', 'major', 'minor', 'major', 'dim',
];

/**
 * Roman-numeral Nashville number for a chord token in a given key.
 * Case already encodes major/minor/diminished for the 7 diatonic degrees, so
 * a redundant leading "m" or "°" in the chord's quality is stripped rather
 * than doubled (e.g. "Am" in C -> "vi", not "vim").
 */
export function toNashvilleNumber(token: string, key: string): string {
  const chord = parseChord(token);
  if (!chord) throw new ChordParseError(token);

  const { pc: keyPc } = resolveKey(key);
  const offset = ((noteToPitchClass(chord.root) - keyPc) % 12 + 12) % 12;

  const numeral = NUMERAL[offset];
  const defaultQuality = DEFAULT_QUALITY[offset];

  let suffix = chord.quality;
  if (defaultQuality === 'minor' && /^m(?!aj)/.test(suffix)) {
    suffix = suffix.slice(1);
  } else if (defaultQuality === 'dim' && (suffix === '°' || /^dim/.test(suffix))) {
    suffix = suffix.replace(/^dim/, '').replace('°', '');
  }

  if (!chord.bass) return numeral + suffix;

  const bassOffset = ((noteToPitchClass(chord.bass) - keyPc) % 12 + 12) % 12;
  return `${numeral}${suffix}/${NUMERAL[bassOffset]}`;
}
