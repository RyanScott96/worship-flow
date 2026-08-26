const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Pitch class (0-11) of a note name like "F#", "Bb", "C". Single accidental only. */
export function noteToPitchClass(note: string): number {
  const letter = note[0];
  const accidental = note[1];
  let pc = LETTER_PC[letter];
  if (pc === undefined) throw new Error(`Not a note letter: "${note}"`);
  if (accidental === '#') pc += 1;
  if (accidental === 'b') pc -= 1;
  return ((pc % 12) + 12) % 12;
}
