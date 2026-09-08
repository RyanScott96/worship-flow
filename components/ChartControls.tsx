import { MAJOR_KEY_TABLES, MINOR_KEY_INFO } from "@/lib/transpose";

export type Mode = "chords" | "lyrics" | "nashville";

export const MODES: Mode[] = ["chords", "lyrics", "nashville"];
export const MODE_LABEL: Record<Mode, string> = {
  chords: "Chords",
  lyrics: "Lyrics",
  nashville: "Nashville",
};
export const KEY_OPTIONS = [
  ...Object.keys(MAJOR_KEY_TABLES),
  ...Object.keys(MINOR_KEY_INFO),
];

/** Free-typed capo value -> a whole fret in 0..11 (the `max` attr only bounds the spinner). */
export const clampCapo = (raw: string) => {
  const n = Math.floor(Number(raw));
  return Number.isFinite(n) ? Math.max(0, Math.min(11, n)) : 0;
};

const segButton = (active: boolean) =>
  `px-2 py-0.5 ${
    active ? "bg-foreground text-background" : "text-black/60 dark:text-white/60"
  }`;

/**
 * The key / capo / capo-view / render-mode control cluster shared by the setlist
 * viewer and the single-arrangement viewer (ROADMAP Phase 3). Presentational —
 * the parent owns the state and the render pipeline; this renders the inputs and
 * reports changes. `capoKey` is `resolveChartView(...).shapeKey`: non-null once a
 * capo is set on a key the app knows.
 */
export function ChartControls({
  sourceKey,
  keyOverride,
  onKeyOverride,
  capo,
  onCapo,
  capoKey,
  capoView,
  onCapoView,
  mode,
  onMode,
}: {
  sourceKey: string | null;
  keyOverride: string;
  onKeyOverride: (value: string) => void;
  capo: number;
  onCapo: (fret: number) => void;
  capoKey: string | null;
  capoView: "sounding" | "capo";
  onCapoView: (view: "sounding" | "capo") => void;
  mode: Mode;
  onMode: (mode: Mode) => void;
}) {
  return (
    <>
      <label className="flex items-center gap-1">
        <span className="text-black/50 dark:text-white/50">Key</span>
        <select
          value={keyOverride}
          onChange={(e) => onKeyOverride(e.target.value)}
          className="rounded border border-black/15 bg-white px-1 py-0.5 text-black dark:border-white/20 dark:bg-neutral-900 dark:text-white"
        >
          <option value="">As written{sourceKey ? ` (${sourceKey})` : ""}</option>
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
          onChange={(e) => onCapo(clampCapo(e.target.value))}
          className="w-12 rounded border border-black/15 bg-transparent px-1 py-0.5 dark:border-white/20"
        />
      </label>
      {/* Always in the layout — only meaningful once a capo is set, but toggling
          `invisible` instead of mounting keeps the toolbar from reflowing (and
          dropping a fresh button under the pointer) the moment the capo field
          goes from 0 to 1. */}
      <div
        aria-hidden={!capoKey}
        className={`flex overflow-hidden rounded border border-black/15 dark:border-white/20 ${
          capoKey ? "" : "invisible"
        }`}
      >
        <button
          type="button"
          tabIndex={capoKey ? undefined : -1}
          onClick={() => onCapoView("sounding")}
          className={segButton(capoView === "sounding")}
        >
          Sounding
        </button>
        <button
          type="button"
          tabIndex={capoKey ? undefined : -1}
          onClick={() => onCapoView("capo")}
          className={`${segButton(capoView === "capo")} tabular-nums`}
        >
          Capo {capo}
        </button>
      </div>
      <div className="flex overflow-hidden rounded border border-black/15 dark:border-white/20">
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onMode(m)}
            className={segButton(mode === m)}
          >
            {MODE_LABEL[m]}
          </button>
        ))}
      </div>
    </>
  );
}
