// Human-readable Markdown for the pilot go/no-go (ROADMAP Phase 1.5 step 1):
// per chart, the extracted ChordPro next to its warnings and metrics.

import type { ChartRecord, Manifest } from "./types";

function fence(body: string): string {
  // OCR text is uncontrolled — use a fence longer than any backtick run in it.
  const longest = (body.match(/`+/g) ?? []).reduce((n, r) => Math.max(n, r.length), 0);
  const bar = "`".repeat(Math.max(3, longest + 1));
  return `${bar}\n${body}\n${bar}`;
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

  // The pilot go/no-go line (ROADMAP Phase 1.5 step 1): which originals to pull.
  const belowFloor = records.filter((r) => r.warnings.checks.ocrConfidence.flagged);
  const floor = records[0]?.warnings.checks.ocrConfidence.floor ?? 75;
  out.push(
    `**${belowFloor.length} of ${records.length} chart(s) below the OCR confidence floor (${floor})** — ` +
      (belowFloor.length
        ? `re-scan these originals at 300 dpi grayscale: ${belowFloor.map((r) => `#${r.index}`).join(", ")}.`
        : "scanner settings look adequate for this batch."),
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
    if (w.checks.ocrConfidence.flagged) {
      out.push(`> [!WARNING]`);
      out.push(`> **RE-SCAN CANDIDATE** — mean OCR confidence ${w.checks.ocrConfidence.meanConf} < ${w.checks.ocrConfidence.floor}.`);
      out.push("");
    }
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
