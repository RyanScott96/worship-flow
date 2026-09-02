"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { parse, toPositionedChart, type PositionedSection } from "@/lib/chordpro";
import {
  MAJOR_KEY_TABLES,
  MINOR_KEY_INFO,
  resolveChartView,
} from "@/lib/transpose";
import {
  SERVICE_ITEM_TYPE_LABEL,
  type ServiceItemDetail,
  type ServiceRow,
} from "@/lib/db/types";
import { ChordLyricChart } from "./ChordLyricChart";
import { VerificationBadge } from "./VerificationBadge";

type Mode = "chords" | "lyrics" | "nashville";

const MODES: Mode[] = ["chords", "lyrics", "nashville"];
const MODE_LABEL: Record<Mode, string> = {
  chords: "Chords",
  lyrics: "Lyrics",
  nashville: "Nashville",
};
const KEY_OPTIONS = [...Object.keys(MAJOR_KEY_TABLES), ...Object.keys(MINOR_KEY_INFO)];

const clamp = (n: number, len: number) => Math.max(0, Math.min(len - 1, n));

/** Free-typed capo input -> a whole fret in 0..11 (the `max` attr only bounds the spinner). */
const clampCapo = (raw: string) => {
  const n = Math.floor(Number(raw));
  return Number.isFinite(n) ? Math.max(0, Math.min(11, n)) : 0;
};

const segButton = (active: boolean) =>
  `px-2 py-0.5 ${
    active ? "bg-foreground text-background" : "text-black/60 dark:text-white/60"
  }`;

export function SetlistViewer({
  service,
  items,
  startIndex,
}: {
  service: ServiceRow;
  items: ServiceItemDetail[];
  startIndex: number;
}) {
  const [index, setIndex] = useState(() => clamp(startIndex, items.length));
  const [mode, setMode] = useState<Mode>("chords");
  const [keyOverride, setKeyOverride] = useState("");
  const [capo, setCapo] = useState(0);
  const [capoView, setCapoView] = useState<"sounding" | "capo">("capo");

  const item = items[index] as ServiceItemDetail | undefined;
  const isSong = !!item && item.item_type === "song" && !!item.chordpro_body;

  // Per-song controls are a reading aid — seed them from this song's setlist
  // values, and re-seed whenever the current item changes. "Adjust state during
  // render", not an effect (https://react.dev/learn/you-might-not-need-an-effect).
  // -1 sentinel so this also runs on the very first render (direct ?i= link).
  const [syncedIndex, setSyncedIndex] = useState(-1);
  if (syncedIndex !== index) {
    setSyncedIndex(index);
    setKeyOverride(item?.key_override ?? "");
    setCapo(item?.capo ?? 0);
    setCapoView("capo");
  }

  // Keep the index in the URL so a refresh / back lands on the same item.
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("i", String(index));
    window.history.replaceState(null, "", url);
  }, [index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Left the pedal / PageUp-Down / Space bindings out on purpose — Space and
      // PageDown also scroll a tall chart, and a focused control needs its own
      // keys. Bluetooth-pedal support is a later slice.
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, select, textarea, button, a, [contenteditable]")) return;
      e.preventDefault();
      setIndex((i) => clamp(i + (e.key === "ArrowRight" ? 1 : -1), items.length));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items.length]);

  const go = (delta: number) => setIndex((i) => clamp(i + delta, items.length));

  const title = item
    ? item.item_type === "song"
      ? item.song_title
      : item.title
    : null;

  // Build the chart for a song item — same pipeline (and error handling) as the
  // setlist screen and print, via toPositionedChart.
  let sourceKey: string | null = null;
  let capoKey: string | null = null;
  let chartError: string | null = null;
  let sections: PositionedSection[] | null = null;
  if (isSong && item?.chordpro_body) {
    const doc = parse(item.chordpro_body);
    sourceKey = doc.directives.key || null;
    const view = resolveChartView({
      sourceKey,
      overrideKey: keyOverride || null,
      capo,
    });
    capoKey = view.shapeKey;
    const target = capoKey && capoView === "capo" ? capoKey : view.soundingKey;
    const result = toPositionedChart(doc, target, mode === "nashville" ? "nashville" : "chords");
    sections = result.sections;
    chartError = result.error;
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background text-foreground">
      {/* Bar */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-black/10 px-4 py-2 text-sm dark:border-white/15">
        <span className="truncate font-semibold">{service.name}</span>
        {item && (
          <>
            <span className="tabular-nums text-black/50 dark:text-white/50">
              {index + 1} / {items.length}
            </span>
            <span className="font-medium">{title}</span>
            {item.item_type === "song" ? (
              <span className="text-black/50 dark:text-white/50">
                {item.arrangement_name}
              </span>
            ) : (
              <span className="uppercase tracking-wide text-black/45 dark:text-white/45">
                {SERVICE_ITEM_TYPE_LABEL[item.item_type]}
              </span>
            )}
            {isSong && item.review_status && (
              <VerificationBadge status={item.review_status} />
            )}
          </>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {isSong && (
            <>
              <label className="flex items-center gap-1">
                <span className="text-black/50 dark:text-white/50">Key</span>
                <select
                  value={keyOverride}
                  onChange={(e) => setKeyOverride(e.target.value)}
                  className="rounded border border-black/15 bg-white px-1 py-0.5 text-black dark:border-white/20 dark:bg-neutral-900 dark:text-white"
                >
                  <option value="">
                    As written{sourceKey ? ` (${sourceKey})` : ""}
                  </option>
                  {KEY_OPTIONS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-1">
                <span className="text-black/50 dark:text-white/50">Capo</span>
                <input
                  type="number"
                  min={0}
                  max={11}
                  value={capo}
                  onChange={(e) => setCapo(clampCapo(e.target.value))}
                  className="w-12 rounded border border-black/15 bg-transparent px-1 py-0.5 dark:border-white/20"
                />
              </label>
              {capoKey && (
                <div className="flex overflow-hidden rounded border border-black/15 dark:border-white/20">
                  <button
                    type="button"
                    onClick={() => setCapoView("sounding")}
                    className={segButton(capoView === "sounding")}
                  >
                    Sounding
                  </button>
                  <button
                    type="button"
                    onClick={() => setCapoView("capo")}
                    className={segButton(capoView === "capo")}
                  >
                    Capo {capo}
                  </button>
                </div>
              )}
              <div className="flex overflow-hidden rounded border border-black/15 dark:border-white/20">
                {MODES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={segButton(mode === m)}
                  >
                    {MODE_LABEL[m]}
                  </button>
                ))}
              </div>
            </>
          )}
          <Link
            href={`/services/${service.id}`}
            aria-label="Close viewer"
            className="rounded px-2 py-1 text-xl leading-none hover:bg-black/5 dark:hover:bg-white/10"
          >
            ×
          </Link>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto px-5 py-6">
        {!item ? (
          <div className="flex h-full items-center justify-center text-black/60 dark:text-white/60">
            Nothing in this service yet.
          </div>
        ) : isSong && !chartError && sections ? (
          <div className="mx-auto max-w-4xl">
            <ChordLyricChart
              sections={sections}
              size="xl"
              variant={mode === "lyrics" ? "lyrics" : "chords"}
            />
          </div>
        ) : isSong && chartError ? (
          <p className="mx-auto max-w-3xl text-lg font-semibold text-red-600 dark:text-red-400">
            {chartError}
          </p>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <span className="text-sm uppercase tracking-widest text-black/45 dark:text-white/45">
              {item.item_type === "song"
                ? "No chart"
                : SERVICE_ITEM_TYPE_LABEL[item.item_type]}
            </span>
            <span className="text-3xl font-semibold">{title}</span>
            {item.notes && (
              <p className="max-w-xl text-black/60 dark:text-white/60">{item.notes}</p>
            )}
          </div>
        )}
      </div>

      {/* Nav */}
      <div className="flex border-t border-black/10 dark:border-white/15">
        <button
          type="button"
          onClick={() => go(-1)}
          disabled={index === 0}
          className="flex-1 py-4 text-lg disabled:opacity-30"
        >
          ‹ Prev
        </button>
        <div className="w-px bg-black/10 dark:bg-white/15" />
        <button
          type="button"
          onClick={() => go(1)}
          disabled={index >= items.length - 1}
          className="flex-1 py-4 text-lg disabled:opacity-30"
        >
          Next ›
        </button>
      </div>
    </div>
  );
}
