"use client";

import { useState, type ReactNode } from "react";

/**
 * A capo song on the service page: one chart at a time, with a switch between
 * the plain key chart (piano / bass / no capo) and the capo shapes. Printing
 * shows both — this toggle is just for the screen.
 *
 * Both charts are rendered on the server and passed in; this component only
 * flips which one is visible, so `lib/chordpro` / `lib/transpose` never reach
 * the client bundle and nothing re-parses on a toggle click.
 */
export function CapoChartToggle({
  capo,
  soundingChart,
  capoChart,
}: {
  capo: number | null;
  soundingChart: ReactNode;
  capoChart: ReactNode;
}) {
  const [view, setView] = useState<"sounding" | "capo">("sounding");

  const tab = (value: "sounding" | "capo", label: string) => (
    <button
      type="button"
      onClick={() => setView(value)}
      aria-pressed={view === value}
      className={`rounded border px-2 py-0.5 text-xs ${
        view === value
          ? "border-black/40 font-medium dark:border-white/50"
          : "border-black/15 text-black/55 dark:border-white/20 dark:text-white/55"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1">
        {tab("sounding", "Key")}
        {tab("capo", capo ? `Capo ${capo}` : "Capo")}
      </div>
      <div hidden={view !== "sounding"}>{soundingChart}</div>
      <div hidden={view !== "capo"}>{capoChart}</div>
    </div>
  );
}
