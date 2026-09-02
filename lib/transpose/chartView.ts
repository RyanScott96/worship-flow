import { capoIsSet, formatCapoLabel, shapeKeyForCapo } from './capo';

export interface ChartView {
  /** The key the chart sounds in — what piano, bass, and a no-capo player read. Null if no key is known. */
  soundingKey: string | null;
  /** The shape key a capo'd guitarist fingers. Null when there's no capo, or the key isn't one the app knows. */
  shapeKey: string | null;
  /** "Capo 3 · play in G · sounds in Bb" / "Play in G". Null only when there's no key, or a capo is set on an unknown key. */
  capoLabel: string | null;
}

/**
 * Resolve what a chart should actually render as, from the raw inputs a caller
 * has: the arrangement's own `{key}`, an optional per-view override (a setlist
 * `key_override`, an editor "preview in key"), and an optional capo fret.
 *
 * Pure and total — it never throws. An unknown key or an impossible capo yields
 * `shapeKey: null` / `capoLabel: null`; the caller decides how to surface that.
 * Both `ChordProPreviewPane` and `ServiceSongChart` (and the Phase 3 viewer) run
 * through here so the key/capo → render-target rule lives in exactly one place.
 */
export function resolveChartView(input: {
  sourceKey: string | null;
  overrideKey?: string | null;
  capo?: number | null;
}): ChartView {
  const soundingKey = input.overrideKey || input.sourceKey || null;
  if (!soundingKey) {
    return { soundingKey: null, shapeKey: null, capoLabel: null };
  }
  if (!capoIsSet(input.capo)) {
    return { soundingKey, shapeKey: null, capoLabel: formatCapoLabel(soundingKey, 0) };
  }
  try {
    return {
      soundingKey,
      shapeKey: shapeKeyForCapo(soundingKey, input.capo),
      capoLabel: formatCapoLabel(soundingKey, input.capo),
    };
  } catch {
    // soundingKey isn't a key the app knows — no capo math is possible.
    return { soundingKey, shapeKey: null, capoLabel: null };
  }
}
