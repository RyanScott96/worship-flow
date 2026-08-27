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
import { MAJOR_KEY_TABLES, MINOR_KEY_INFO, formatCapoLabel } from "@/lib/transpose";

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
 */
export function ChordProPreviewPane({ text }: { text: string }) {
  const [mode, setMode] = useState<Mode>("chords");
  const [previewKey, setPreviewKey] = useState("");
  const [capoFret, setCapoFret] = useState(0);

  const doc = useMemo(() => parse(text), [text]);
  const docKey = doc.directives.key || null;

  const activeDoc = useMemo(() => {
    if (!previewKey) return doc;
    try {
      return transposeDocument(doc, previewKey);
    } catch {
      return doc;
    }
  }, [doc, previewKey]);

  const soundingKey = previewKey || docKey;

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
    <div className="flex flex-col gap-3 rounded border border-black/10 p-4 dark:border-white/15">
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
            className="rounded border border-black/15 bg-transparent px-1 py-0.5 dark:border-white/20"
          >
            <option value="">{docKey ? `As written (${docKey})` : "No {key} set"}</option>
            {KEY_OPTIONS.map((k) => (
              <option key={k} value={k}>
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
        {soundingKey && (
          <span className="text-black/60 dark:text-white/60">
            {formatCapoLabel(soundingKey, capoFret)}
          </span>
        )}
      </div>

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : (
        <pre className="whitespace-pre-wrap font-mono text-sm">{body}</pre>
      )}
    </div>
  );
}
