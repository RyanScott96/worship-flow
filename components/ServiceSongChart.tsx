import { parse, toChordsAndLyricsText, transposeDocument } from "@/lib/chordpro";
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
      active = doc;
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
 * Render one setlist song for the whole band. Always shows the chart in the
 * sounding key (`keyOverride ?? {key}`) — that's what piano, bass and anyone
 * without a capo plays. When a capo is set it *adds* the guitar chart in the
 * shape key (D-02, DOMAIN.md §4: capo is a per-player choice).
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

  return (
    <div className="flex flex-col gap-3">
      <Chart
        label={
          hasCapo && soundingKey
            ? `Sounds in ${soundingKey} — piano, bass, no capo`
            : soundingKey
              ? `Key of ${soundingKey}`
              : "As written"
        }
        body={sounding.body}
        error={sounding.error}
      />
      {capoChart && soundingKey && (
        <Chart
          label={formatCapoLabel(soundingKey, capo ?? 0)}
          body={capoChart.body}
          error={capoChart.error}
        />
      )}
    </div>
  );
}
