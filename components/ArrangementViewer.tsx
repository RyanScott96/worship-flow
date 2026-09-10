"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { parse, toPositionedChart } from "@/lib/chordpro";
import { resolveChartView } from "@/lib/transpose";
import { useWakeLock } from "@/lib/use-wake-lock";
import type { ArrangementRow } from "@/lib/db/types";
import { ChordLyricChart } from "./ChordLyricChart";
import { ChartControls, type Mode } from "./ChartControls";
import { VerificationBadge } from "./VerificationBadge";

/**
 * The single-arrangement tablet viewer (ROADMAP Phase 3): one chart, full-bleed,
 * large type, with the same key / capo / render-mode reading aids as the setlist
 * viewer but no set to page through. Reached from the arrangement page; the ×
 * closes back to it.
 *
 * `initialKey` / `initialCapo` seed the controls and are kept in the URL as
 * `?key=` / `?capo=`, so a reload on a music stand holds its place and a link can
 * open the chart in a specific key. Default is the arrangement's own `{key}`.
 */
export function ArrangementViewer({
  songId,
  arrangement,
  initialKey = "",
  initialCapo = 0,
}: {
  songId: string;
  arrangement: ArrangementRow & { song_title: string };
  initialKey?: string;
  initialCapo?: number;
}) {
  const [mode, setMode] = useState<Mode>("chords");
  const [keyOverride, setKeyOverride] = useState(initialKey);
  const [capo, setCapo] = useState(initialCapo);
  const [capoView, setCapoView] = useState<"sounding" | "capo">(
    initialCapo > 0 ? "capo" : "sounding",
  );

  useWakeLock();

  useEffect(() => {
    const url = new URL(window.location.href);
    if (keyOverride) url.searchParams.set("key", keyOverride);
    else url.searchParams.delete("key");
    if (capo > 0) url.searchParams.set("capo", String(capo));
    else url.searchParams.delete("capo");
    window.history.replaceState(null, "", url);
  }, [keyOverride, capo]);

  // Same render pipeline as the setlist screen and print, via toPositionedChart.
  const doc = parse(arrangement.chordpro_body);
  const sourceKey = doc.directives.key || null;
  const view = resolveChartView({
    sourceKey,
    overrideKey: keyOverride || null,
    capo,
  });
  const capoKey = view.shapeKey;
  const target = capoKey && capoView === "capo" ? capoKey : view.soundingKey;
  const { sections, error: chartError } = toPositionedChart(
    doc,
    target,
    mode === "nashville" ? "nashville" : "chords",
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background text-foreground">
      {/* Bar */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-black/10 px-4 py-2 text-sm dark:border-white/15">
        <span className="truncate font-semibold">{arrangement.song_title}</span>
        <span className="text-black/50 dark:text-white/50">{arrangement.name}</span>
        <VerificationBadge status={arrangement.review_status} />

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <ChartControls
            sourceKey={sourceKey}
            keyOverride={keyOverride}
            onKeyOverride={setKeyOverride}
            capo={capo}
            onCapo={setCapo}
            capoKey={capoKey}
            capoView={capoView}
            onCapoView={setCapoView}
            mode={mode}
            onMode={setMode}
          />
          <Link
            href={`/songs/${songId}/arrangements/${arrangement.id}`}
            aria-label="Close viewer"
            className="rounded px-2 py-1 text-xl leading-none hover:bg-black/5 dark:hover:bg-white/10"
          >
            ×
          </Link>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto px-5 py-6">
        {chartError ? (
          <p className="mx-auto max-w-3xl text-lg font-semibold text-red-600 dark:text-red-400">
            {chartError}
          </p>
        ) : sections ? (
          <div className="mx-auto max-w-4xl">
            <ChordLyricChart
              sections={sections}
              size="xl"
              variant={mode === "lyrics" ? "lyrics" : "chords"}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
