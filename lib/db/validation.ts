import { parse } from "@/lib/chordpro";
import { resolveKey } from "@/lib/transpose";

export class ArrangementValidationError extends Error {}

/**
 * The {key: ...} directive in the ChordPro text is the single source of
 * truth for an arrangement's key — `arrangement.source_key` is derived from
 * it on every save, rather than kept as an independently-editable field, so
 * the two can never drift out of sync.
 */
export function deriveSourceKey(chordproBody: string): string {
  const doc = parse(chordproBody);
  const key = doc.directives.key;
  if (!key) {
    throw new ArrangementValidationError(
      "Add a {key: ...} line to this chart before saving.",
    );
  }
  try {
    resolveKey(key);
  } catch {
    throw new ArrangementValidationError(
      `"${key}" isn't a key this app recognizes. Use a standard major/minor key, e.g. G, Bb, F#m.`,
    );
  }
  return key;
}
