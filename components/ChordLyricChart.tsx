import type { PositionedSection } from "@/lib/chordpro";

const SECTION_WORD: Partial<Record<string, string>> = {
  verse: "Verse",
  chorus: "Chorus",
  bridge: "Bridge",
};

/**
 * Chords-above-lyrics render (D-18): each chord sits over the syllable it lands
 * on, lead-sheet style. Presentational only — the caller builds `sections`
 * (`parse` → optional `transposeDocument` → `toPositionedSections`), so this
 * renders from a server or a client component alike (like `VerificationBadge`).
 *
 * Each `{ chord, lyric }` cell is an atomic column; the `flex flex-wrap` line
 * breaks only *between* cells, so a chord never separates from its syllable and
 * a long line reflows without losing alignment.
 */
export function ChordLyricChart({
  sections,
  size = "normal",
}: {
  sections: PositionedSection[];
  size?: "normal" | "large";
}) {
  const typeScale =
    size === "large" ? "text-lg leading-tight sm:text-xl" : "text-sm leading-tight";
  const chordScale = size === "large" ? "text-[0.72em]" : "text-[0.8em]";

  return (
    <div className={`flex flex-col gap-4 ${typeScale}`}>
      {sections.map((section, si) => (
        <section key={si} className="flex flex-col">
          {(section.label || section.type) && (
            <p className="mb-1 font-semibold text-black/55 dark:text-white/55">
              {section.label ?? SECTION_WORD[section.type as string] ?? section.type}
            </p>
          )}
          {section.lines.map((line, li) =>
            line.kind === "comment" ? (
              <p key={li} className="italic text-black/55 dark:text-white/55">
                {line.text}
              </p>
            ) : (
              <div key={li} data-chart-line className="flex flex-wrap gap-y-1">
                {line.cells.map((cell, ci) => (
                  <span key={ci} className="inline-flex flex-col">
                    <span
                      className={`font-mono font-semibold leading-none ${chordScale} ${
                        cell.chord ? "pr-2" : ""
                      }`}
                    >
                      {cell.chord || " "}
                    </span>
                    <span className="whitespace-pre-wrap">{cell.lyric || " "}</span>
                  </span>
                ))}
              </div>
            ),
          )}
        </section>
      ))}
    </div>
  );
}
