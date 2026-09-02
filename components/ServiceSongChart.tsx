import { parse, toPositionedChart, toPositionedSections } from "@/lib/chordpro";
import type { PositionedSection } from "@/lib/chordpro";
import { resolveChartView } from "@/lib/transpose";
import { ChordLyricChart } from "./ChordLyricChart";

function Chart({
  label,
  sections,
  error,
}: {
  label: string;
  sections: PositionedSection[] | null;
  error: string | null;
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-medium text-black/60 dark:text-white/60">{label}</p>
      {error ? (
        <p
          data-chart-error
          className="text-sm font-semibold text-red-600 dark:text-red-400"
        >
          {error}
        </p>
      ) : (
        <ChordLyricChart sections={sections ?? []} />
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
    return (
      <div className="flex flex-col gap-1">
        <p className="text-xs font-medium text-black/60 dark:text-white/60">Lyrics</p>
        <ChordLyricChart sections={toPositionedSections(doc)} variant="lyrics" />
      </div>
    );
  }

  const sourceKey = doc.directives.key || null;
  const view = resolveChartView({ sourceKey, overrideKey: keyOverride, capo });

  const sounding = toPositionedChart(doc, view.soundingKey);
  const capoChart = view.shapeKey ? toPositionedChart(doc, view.shapeKey) : null;

  // "capo" mode shows the capo chart alone; on a song with no capo there's
  // nothing to show but the plain key chart, so fall back to it.
  const showCapoChart = !!capoChart && mode !== "sounding";
  const showKeyChart = mode !== "capo" || !showCapoChart;

  return (
    <div className="flex flex-col gap-3">
      {showKeyChart && (
        <Chart
          label={view.soundingKey ? `Key of ${view.soundingKey}` : "As written"}
          sections={sounding.sections}
          error={sounding.error}
        />
      )}
      {showCapoChart && capoChart && (
        <Chart
          label={view.capoLabel ?? ""}
          sections={capoChart.sections}
          error={capoChart.error}
        />
      )}
    </div>
  );
}
