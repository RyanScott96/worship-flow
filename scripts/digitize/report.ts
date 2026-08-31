// Human-readable Markdown for the pilot go/no-go (ROADMAP Phase 1.5 step 1):
// per chart, the extracted ChordPro next to its warnings and metrics.

import type { ChartRecord, Manifest } from "./types";

function fence(body: string): string {
  // ChordPro bodies never contain a backtick, so a plain fence is safe.
  return "```\n" + body + "\n```";
}

export function renderReport(
  manifest: Manifest,
  records: ChartRecord[],
  failed: { index: number; reason: string }[],
): string {
  const out: string[] = [];
  out.push(`# Digitization report — batch \`${manifest.batchId}\``);
  out.push("");
  out.push(`Generated ${new Date().toISOString()}`);
  out.push("");

  const flaggedCount = records.filter((r) => r.warnings.notes.length > 0).length;
  out.push(
    `${records.length} chart(s) extracted, ${flaggedCount} with warnings, ${failed.length} failed.`,
  );
  out.push("");

  if (failed.length) {
    out.push("## Failed");
    out.push("");
    for (const f of failed) out.push(`- chart ${f.index}: ${f.reason}`);
    out.push("");
  }

  out.push("## Charts");
  out.push("");
  for (const r of records) {
    const w = r.warnings;
    out.push(`### #${r.index} — ${r.arrangementName}`);
    out.push("");
    out.push(
      `- key: \`${r.sourceKey}\` (${w.keyDetection.method}${w.keyDetection.confident ? "" : ", low confidence"})`,
    );
    out.push(
      `- lines: ${r.metrics.chordLineCount} chord / ${r.metrics.lyricLineCount} lyric (ratio ${r.metrics.chordLyricRatio})`,
    );
    out.push(`- mean OCR confidence: ${r.metrics.meanOcrConf}`);
    out.push(
      `- pages: ${r.scan.pageCount} extracted / ${w.checks.pageCount.expected} expected${w.checks.pageCount.flagged ? "  ⚠️ MISMATCH" : ""}`,
    );
    out.push(
      `- structure: ${w.structure.stackedChordLines} stacked, ${w.structure.instrumentalLines} instrumental, ${w.structure.unlabeledSections} unlabeled${w.structure.multiColumnSuspected ? ", MULTI-COLUMN?" : ""}`,
    );
    out.push("");
    if (w.notes.length) {
      out.push("**Warnings**");
      out.push("");
      for (const n of w.notes) out.push(`- ${n}`);
      out.push("");
    }
    out.push("**Extracted ChordPro**");
    out.push("");
    out.push(fence(r.chordproBody));
    out.push("");
  }

  return out.join("\n");
}
