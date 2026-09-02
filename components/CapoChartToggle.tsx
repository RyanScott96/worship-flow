"use client";

import { useState } from "react";
import { ServiceSongChart } from "@/components/ServiceSongChart";

/**
 * A capo song on the service page: one chart at a time, with a switch between
 * the sounding key (piano / bass / no capo) and the capo shapes. Printing shows
 * both — this toggle is just for the screen.
 */
export function CapoChartToggle({
  chordproBody,
  keyOverride,
  capo,
}: {
  chordproBody: string;
  keyOverride: string | null;
  capo: number | null;
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
        {tab("sounding", "Sounding key")}
        {tab("capo", capo ? `Capo ${capo}` : "Capo")}
      </div>
      <ServiceSongChart
        chordproBody={chordproBody}
        keyOverride={keyOverride}
        capo={capo}
        mode={view}
      />
    </div>
  );
}
