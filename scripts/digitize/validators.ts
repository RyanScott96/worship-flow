// The four cheap, local validators from docs/DOMAIN.md §7. None block import —
// they populate arrangement.extraction_warnings and the pilot report.

import { noteToPitchClass, parseChord, resolveKey, toNashvilleNumber } from "../../lib/transpose";
import { isChordish } from "./classify";
import type { OutSection } from "./sections";
import type { ExtractionWarnings } from "./types";

const BRACKETED = /\[([^\]]*)\]/g;

// Semitone offsets from the tonic that count as "in key". Minor allows the
// natural-minor scale plus the raised 7th (harmonic minor) so v/V and vii° both
// pass — otherwise every minor chart flags its own I, iv and V as misreads.
const MAJOR_DEGREES = new Set([0, 2, 4, 5, 7, 9, 11]);
const MINOR_DEGREES = new Set([0, 2, 3, 5, 7, 8, 10, 11]);

function isMinorKey(key: string): boolean {
  return /m$/.test(key) && !/maj/i.test(key);
}

/** True if the chord's root sits outside the key's scale — a possible misread. */
function isNonDiatonic(token: string, key: string): boolean {
  const chord = parseChord(token);
  if (!chord) return false; // covered by the unparseable check
  let rootPc: number;
  let tonicPc: number;
  try {
    rootPc = noteToPitchClass(chord.root);
    tonicPc = resolveKey(key).pc;
  } catch {
    return false;
  }
  const offset = ((rootPc - tonicPc) % 12 + 12) % 12;
  const allowed = isMinorKey(key) ? MINOR_DEGREES : MAJOR_DEGREES;
  return !allowed.has(offset);
}

export interface ValidateInput {
  sections: OutSection[];
  /** resolveKey-able. */
  key: string;
  chordLines: number;
  lyricLines: number;
  expectedPageCount: number;
  actualPageCount: number;
}

export function runValidators(input: ValidateInput): ExtractionWarnings["checks"] {
  const unparseableChords: ExtractionWarnings["checks"]["unparseableChords"] = [];
  const nonDiatonic = new Map<string, string>(); // chord token -> degree

  for (const section of input.sections) {
    for (const line of section.lines) {
      if (line.kind !== "lyric") continue;
      for (const m of line.text.matchAll(BRACKETED)) {
        const token = m[1];
        if (token === "") continue; // empty [] is legal in ChordPro
        if (!isChordish(token)) {
          unparseableChords.push({
            line: line.sourceLine,
            token,
            context: line.text.slice(0, 80),
          });
          continue;
        }
        if (!nonDiatonic.has(token) && isNonDiatonic(token, input.key)) {
          try {
            nonDiatonic.set(token, toNashvilleNumber(token, input.key));
          } catch {
            nonDiatonic.set(token, "?");
          }
        }
      }
    }
  }

  const lyricLines = Math.max(input.lyricLines, 0);
  const ratio = input.chordLines / Math.max(lyricLines, 1);
  const ratioFlagged =
    ratio > 1.5 || (input.chordLines > 0 && ratio < 0.15) || input.chordLines === 0;

  return {
    unparseableChords,
    nonDiatonicChords: [...nonDiatonic.entries()].map(([chord, degree]) => ({
      chord,
      key: input.key,
      degree,
    })),
    chordLyricRatio: {
      chordLines: input.chordLines,
      lyricLines,
      ratio: Number(ratio.toFixed(3)),
      flagged: ratioFlagged,
    },
    pageCount: {
      expected: input.expectedPageCount,
      actual: input.actualPageCount,
      flagged: input.expectedPageCount !== input.actualPageCount,
    },
  };
}

/** Plain-English lines for report.md / extraction_warnings.notes. */
export function summarizeChecks(checks: ExtractionWarnings["checks"]): string[] {
  const notes: string[] = [];
  if (checks.unparseableChords.length) {
    const toks = [...new Set(checks.unparseableChords.map((u) => u.token))].join(", ");
    notes.push(
      `${checks.unparseableChords.length} bracketed token(s) don't parse as chords: ${toks}`,
    );
  }
  if (checks.nonDiatonicChords.length) {
    const toks = checks.nonDiatonicChords
      .map((n) => `${n.chord} (${n.degree})`)
      .join(", ");
    notes.push(`Chords outside the detected key: ${toks} — possible misreads`);
  }
  if (checks.chordLyricRatio.flagged) {
    notes.push(
      `Chord/lyric line ratio is off (${checks.chordLyricRatio.chordLines} chord / ${checks.chordLyricRatio.lyricLines} lyric)`,
    );
  }
  if (checks.pageCount.flagged) {
    notes.push(
      `Page count mismatch: expected ${checks.pageCount.expected}, extracted ${checks.pageCount.actual} — possible scanner double-feed`,
    );
  }
  return notes;
}
