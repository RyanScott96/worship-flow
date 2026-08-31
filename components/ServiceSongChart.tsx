import { parse, toChordsAndLyricsText, transposeDocument } from "@/lib/chordpro";
import { formatCapoLabel, shapeKeyForCapo } from "@/lib/transpose";

/**
 * Render one setlist song at its per-service key/capo (D-02). Server-side and
 * read-only — the interactive key picker lives on the arrangement page.
 */
export function ServiceSongChart({
  chordproBody,
  keyOverride,
  capo,
}: {
  chordproBody: string;
  keyOverride: string | null;
  capo: number | null;
}) {
  const doc = parse(chordproBody);
  const sourceKey = doc.directives.key || null;
  const soundingKey = keyOverride || sourceKey;

  let activeDoc = doc;
  let capoLabel: string | null = null;

  if (soundingKey) {
    let targetKey = soundingKey;
    if (capo && capo > 0) {
      try {
        targetKey = shapeKeyForCapo(soundingKey, capo);
      } catch {
        targetKey = soundingKey;
      }
    }
    try {
      capoLabel = formatCapoLabel(soundingKey, capo ?? 0);
    } catch {
      capoLabel = null;
    }
    if (targetKey !== sourceKey) {
      try {
        activeDoc = transposeDocument(doc, targetKey);
      } catch {
        activeDoc = doc;
      }
    }
  }

  let body = "";
  let error: string | null = null;
  try {
    body = toChordsAndLyricsText(activeDoc);
  } catch (err) {
    error = err instanceof Error ? err.message : "Could not render this chart.";
  }

  return (
    <div className="flex flex-col gap-2">
      {capoLabel && (
        <p className="text-xs text-black/60 dark:text-white/60">{capoLabel}</p>
      )}
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
