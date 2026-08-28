"use client";

import { useMemo, useState } from "react";
import {
  parse,
  toChordsAndLyricsText,
  toLyricsOnlyText,
  toNashvilleText,
  extractChordSequence,
  transposeDocument,
} from "@/lib/chordpro";
import {
  MAJOR_KEY_TABLES,
  MINOR_KEY_INFO,
  formatCapoLabel,
  shapeKeyForCapo,
} from "@/lib/transpose";

type Mode = "chords" | "lyrics" | "nashville" | "chordsOnly";

const MODE_LABELS: Record<Mode, string> = {
  chords: "Chords + Lyrics",
  lyrics: "Lyrics only",
  nashville: "Nashville",
  chordsOnly: "Chords only",
};

const KEY_OPTIONS = [
  ...Object.keys(MAJOR_KEY_TABLES),
  ...Object.keys(MINOR_KEY_INFO),
];

/**
 * Read-only render of a ChordPro source string: mode tabs (chords+lyrics,
 * lyrics-only, Nashville, chords-only) plus a "preview in key"/capo
 * selector. Transposing here never touches the saved text — only the
 * caller's Save action persists anything.
 *
 * `size="lg"` is for standalone/"just looking at the chart" contexts
 * (bigger type, roomier padding); `size="sm"` (default) is for the
 * side-by-side editor layout where it shares space with the textarea.
 */
export function ChordProPreviewPane({
  text,
  size = "sm",
}: {
  text: string;
  size?: "sm" | "lg";
}) {
  const [mode, setMode] = useState<Mode>("chords");
  const [previewKey, setPreviewKey] = useState("");
  const [capoFret, setCapoFret] = useState(0);

  const doc = useMemo(() => parse(text), [text]);
  const docKey = doc.directives.key || null;

  const soundingKey = previewKey || docKey;

  // A guitarist with a capo on doesn't read the sounding key off the chart —
  // they read the shape they finger. Capo 5 to sound in C means fingering G
  // shapes, so once a capo fret is set the chart itself is transposed to
  // that shape key, not just labeled with it.
  const activeDoc = useMemo(() => {
    if (!soundingKey) return doc;

    let targetKey = soundingKey;
    if (capoFret > 0) {
      try {
        targetKey = shapeKeyForCapo(soundingKey, capoFret);
      } catch {
        targetKey = soundingKey;
      }
    }
    if (targetKey === docKey) return doc;

    try {
      return transposeDocument(doc, targetKey);
    } catch {
      return doc;
    }
  }, [doc, docKey, soundingKey, capoFret]);

  // The {key} directive is only validated on Save (deriveSourceKey), so the
  // live preview can be handed an unrecognized key ("G7", "H", "G/B") while the
  // user is still typing. formatCapoLabel -> shapeKeyForCapo -> resolveKey
  // throws UnknownKeyError on those, and this runs in render with no error
  // boundary above it, so guard it and show a hint instead of crashing.
  let capoLabel: string | null = null;
  let keyWarning: string | null = null;
  if (soundingKey) {
    try {
      capoLabel = formatCapoLabel(soundingKey, capoFret);
    } catch {
      keyWarning = `"${soundingKey}" isn't a key this app recognizes yet — fix the {key} line before saving.`;
    }
  }

  let body = "";
  let error: string | null = null;
  try {
    if (mode === "chords") body = toChordsAndLyricsText(activeDoc);
    else if (mode === "lyrics") body = toLyricsOnlyText(activeDoc);
    else if (mode === "nashville") body = toNashvilleText(activeDoc);
    else body = extractChordSequence(activeDoc).join("  ");
  } catch (err) {
    error = err instanceof Error ? err.message : "Could not render this chart.";
  }

  return (
    <div
      className={`flex flex-col gap-3 rounded border border-black/10 dark:border-white/15 ${
        size === "lg" ? "p-6" : "p-4"
      }`}
    >
      <div className="flex flex-wrap gap-2 text-sm">
        {(Object.keys(MODE_LABELS) as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded px-2 py-1 ${
              mode === m
                ? "bg-foreground text-background"
                : "bg-black/5 dark:bg-white/10"
            }`}
          >
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-1">
          Preview in key
          <select
            value={previewKey}
            onChange={(e) => setPreviewKey(e.target.value)}
            className="rounded border border-black/15 bg-white px-1 py-0.5 text-black dark:border-white/20 dark:bg-neutral-900 dark:text-white"
          >
            <option value="" className="bg-white text-black dark:bg-neutral-900 dark:text-white">
              {docKey ? `As written (${docKey})` : "No {key} set"}
            </option>
            {KEY_OPTIONS.map((k) => (
              <option
                key={k}
                value={k}
                className="bg-white text-black dark:bg-neutral-900 dark:text-white"
              >
                {k}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1">
          Capo
          <input
            type="number"
            min={0}
            max={11}
            value={capoFret}
            onChange={(e) => setCapoFret(Number(e.target.value) || 0)}
            className="w-14 rounded border border-black/15 bg-transparent px-1 py-0.5 dark:border-white/20"
          />
        </label>
        {keyWarning ? (
          <span className="text-amber-600 dark:text-amber-400">{keyWarning}</span>
        ) : (
          capoLabel && (
            <span className="text-black/60 dark:text-white/60">{capoLabel}</span>
          )
        )}
      </div>

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : (
        <pre
          className={`whitespace-pre-wrap font-mono ${
            size === "lg" ? "text-lg leading-relaxed sm:text-xl" : "text-sm"
          }`}
        >
          {body}
        </pre>
      )}
    </div>
  );
}
