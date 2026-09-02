import {
  parse,
  toChordsAndLyricsText,
  toLyricsOnlyText,
  transposeDocument,
} from "@/lib/chordpro";
import type { ChordProDocument } from "@/lib/chordpro";
import { formatCapoLabel, shapeKeyForCapo } from "@/lib/transpose";

/** Transpose `doc` (written in `sourceKey`) to `targetKey`; render chords+lyrics. */
function renderIn(
  doc: ChordProDocument,
  sourceKey: string | null,
  targetKey: string | null,
): { body: string; error: string | null } {
  let active = doc;
  if (targetKey && targetKey !== sourceKey) {
    try {
      active = transposeDocument(doc, targetKey);
    } catch {
      // Don't fall back to the untransposed chart — that would show the wrong
      // key under a confident label. Surface it so someone fixes the source.
      return {
        body: "",
        error: `Couldn't transpose this chart to ${targetKey} — it may have a non-chord bracket like [N.C.] or [x2]. Fix it on the song page.`,
      };
    }
  }
  try {
    return { body: toChordsAndLyricsText(active), error: null };
  } catch (err) {
    return {
      body: "",
      error: err instanceof Error ? err.message : "Could not render this chart.",
    };
  }
}

function Chart({
  label,
  body,
  error,
}: {
  label: string;
  body: string;
  error: string | null;
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-medium text-black/60 dark:text-white/60">{label}</p>
      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : (
        <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed">
          {body}
        </pre>
      )}
    </div>
  );
}

/**
 * Render one chart for one setlist song. A song is only ever one chart here —
 * the caller decides which, and shows both (or a toggle) if it wants both.
 *
 *   - `"sounding"` (default): the `keyOverride ?? {key}` chart — what piano,
 *                  bass and anyone without a capo plays.
 *   - `"capo"`:    the same music in guitar shapes (D-02, DOMAIN.md §4: capo is
 *                  a per-player choice). Falls back to the plain key chart on a
 *                  song with no capo set.
 *   - `"lyrics"`:  lyrics only, chords stripped. Key and capo don't apply.
 */
export function ServiceSongChart({
  chordproBody,
  keyOverride,
  capo,
  mode = "sounding",
}: {
  chordproBody: string;
  keyOverride: string | null;
  capo: number | null;
  mode?: "sounding" | "capo" | "lyrics";
}) {
  const doc = parse(chordproBody);

  if (mode === "lyrics") {
    let body = "";
    let error: string | null = null;
    try {
      body = toLyricsOnlyText(doc);
    } catch (err) {
      error =
        err instanceof Error ? err.message : "Could not render these lyrics.";
    }
    return (
      <div className="flex flex-col gap-3">
        <Chart label="Lyrics" body={body} error={error} />
      </div>
    );
  }

  const sourceKey = doc.directives.key || null;
  const soundingKey = keyOverride || sourceKey;
  const hasCapo = !!capo && capo > 0 && !!soundingKey;

  const sounding = renderIn(doc, sourceKey, soundingKey);

  let shapeKey: string | null = null;
  if (hasCapo && soundingKey) {
    try {
      shapeKey = shapeKeyForCapo(soundingKey, capo);
    } catch {
      shapeKey = null;
    }
  }
  const capoChart = shapeKey ? renderIn(doc, sourceKey, shapeKey) : null;

  // "capo" mode shows the capo chart alone; on a song with no capo there's
  // nothing to show but the plain key chart, so fall back to it.
  const showCapoChart = !!capoChart && !!soundingKey && mode !== "sounding";
  const showKeyChart = mode !== "capo" || !showCapoChart;

  return (
    <div className="flex flex-col gap-3">
      {showKeyChart && (
        <Chart
          label={soundingKey ? `Key of ${soundingKey}` : "As written"}
          body={sounding.body}
          error={sounding.error}
        />
      )}
      {showCapoChart && capoChart && soundingKey && (
        <Chart
          label={formatCapoLabel(soundingKey, capo ?? 0)}
          body={capoChart.body}
          error={capoChart.error}
        />
      )}
    </div>
  );
}
