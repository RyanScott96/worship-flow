import {
  nashvilleTransform,
  toPositionedSections,
  type PositionedSection,
} from './render';
import { transposeDocument } from './transposeDocument';
import type { ChordProDocument } from './types';

export type PositionedChart =
  | { sections: PositionedSection[]; error: null }
  | { sections: null; error: string };

/**
 * The shared render pipeline for every positioned chart surface — the setlist
 * screen, print, and the tablet viewer: transpose `doc` to `targetKey` if it
 * differs from the document's own key, then lay it out as chord/lyric cells.
 *
 * Tolerates everything a reading surface must not crash on: a non-chord bracket
 * (handled downstream), a target key the app can't resolve, and — in Nashville
 * mode — a missing or unresolvable `{key}`. Returns an error string instead of
 * throwing so the caller can show it in place.
 */
export function toPositionedChart(
  doc: ChordProDocument,
  targetKey: string | null,
  mode: 'chords' | 'nashville' = 'chords',
): PositionedChart {
  let active = doc;
  if (targetKey && targetKey !== doc.directives.key) {
    try {
      active = transposeDocument(doc, targetKey);
    } catch {
      return {
        sections: null,
        error: `Couldn't put this chart in ${targetKey} — check the song's key.`,
      };
    }
  }

  if (mode === 'nashville') {
    const key = active.directives.key;
    if (!key) {
      return {
        sections: null,
        error: 'This song has no key set — Nashville numbers need one.',
      };
    }
    try {
      return { sections: toPositionedSections(active, nashvilleTransform(key)), error: null };
    } catch {
      return { sections: null, error: `"${key}" isn't a key this app recognizes.` };
    }
  }

  return { sections: toPositionedSections(active), error: null };
}
