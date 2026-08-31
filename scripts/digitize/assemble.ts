// Pure core of a single chart's extraction: OCR words per page in, ChordPro +
// warnings out. No filesystem, no DB, no shell — everything I/O lives in
// extract.ts. Golden tests drive this directly with committed TSV fixtures.

import { buildChordpro } from "./buildChordpro";
import { detectKey } from "./keydetect";
import { groupLines, pageMetrics } from "./lines";
import { walkPage, type OutSection } from "./sections";
import type { ExtractionWarnings, ManifestChart, OcrLine, OcrWord } from "./types";
import { runValidators, summarizeChecks } from "./validators";

export interface AssembleInput {
  chart: ManifestChart;
  /** One entry per page, in pageStart..pageEnd order. */
  pagesWords: OcrWord[][];
  /** Mean OCR confidence per page (same order). */
  pageMeanConfs: number[];
}

export interface AssembledChart {
  extractedTitle: string | null;
  arrangementName: string;
  sourceKey: string;
  chordproBody: string;
  keyDetection: ExtractionWarnings["keyDetection"];
  checks: ExtractionWarnings["checks"];
  structure: ExtractionWarnings["structure"];
  metrics: {
    meanOcrConf: number;
    chordLineCount: number;
    lyricLineCount: number;
    chordLyricRatio: number;
  };
  notes: string[];
}

/** Two well-separated clusters of line start-x is a two-column page. */
function suspectMultiColumn(lines: OcrLine[]): boolean {
  const xs = lines.map((l) => l.xLeft).sort((a, b) => a - b);
  if (xs.length < 6) return false;
  const min = xs[0];
  const max = Math.max(...lines.map((l) => l.xRight));
  const span = max - min;
  if (span <= 0) return false;
  let left = 0;
  let right = 0;
  for (const x of xs) {
    if ((x - min) / span < 0.15) left++;
    else if ((x - min) / span > 0.4) right++;
  }
  return left >= xs.length * 0.25 && right >= xs.length * 0.25;
}

export function assembleChart(input: AssembleInput): AssembledChart {
  const { chart, pagesWords, pageMeanConfs } = input;

  const allLines: OcrLine[] = [];
  const sections: OutSection[] = [];
  const chordTokens: string[] = [];
  const structure = {
    stackedChordLines: 0,
    instrumentalLines: 0,
    unlabeledSections: 0,
    multiColumnSuspected: false,
  };
  let chordLines = 0;
  let lyricLines = 0;
  let titleCandidate: string | null = null;
  let copyrightLine: string | null = null;

  pagesWords.forEach((words, pageIdx) => {
    const lines = groupLines(words);
    const metrics = pageMetrics(lines);
    const walk = walkPage(lines, metrics, pageIdx === 0);

    allLines.push(...lines);
    sections.push(...walk.sections);
    chordTokens.push(...walk.chordTokens);
    structure.stackedChordLines += walk.structure.stackedChordLines;
    structure.instrumentalLines += walk.structure.instrumentalLines;
    structure.unlabeledSections += walk.structure.unlabeledSections;
    chordLines += walk.counts.chordLines;
    lyricLines += walk.counts.lyricLines;
    titleCandidate ??= walk.titleCandidate;
    copyrightLine ??= walk.copyrightLine;
    if (suspectMultiColumn(lines)) structure.multiColumnSuspected = true;
  });

  const key = detectKey({
    allLines,
    chordTokens,
    manifestKey: chart.key,
    titleText: titleCandidate,
  });

  const extractedTitle = titleCandidate;
  const arrangementName =
    (chart.title ?? extractedTitle ?? `Scanned ${new Date().toISOString().slice(0, 10)}`).trim();

  const chordproBody = buildChordpro({
    title: chart.title ?? extractedTitle ?? arrangementName,
    key: key.key,
    copyright: copyrightLine,
    sections,
  });

  const checks = runValidators({
    sections,
    key: key.key,
    chordLines,
    lyricLines,
    expectedPageCount: chart.expectedPageCount,
    actualPageCount: pagesWords.length,
  });

  const notes = summarizeChecks(checks);
  if (key.note) notes.unshift(key.note);
  if (structure.multiColumnSuspected) {
    notes.push("MULTI-COLUMN page suspected — re-scan as a single column if the chart looks scrambled.");
  }
  if (structure.stackedChordLines > 0) {
    notes.push(
      `${structure.stackedChordLines} stacked chord line(s) emitted without a lyric partner — check ordering.`,
    );
  }

  const meanOcrConf =
    pageMeanConfs.length === 0
      ? 0
      : Number(
          (pageMeanConfs.reduce((s, c) => s + c, 0) / pageMeanConfs.length).toFixed(1),
        );

  return {
    extractedTitle,
    arrangementName,
    sourceKey: key.key,
    chordproBody,
    keyDetection: { method: key.method, key: key.key, confident: key.confident },
    checks,
    structure,
    metrics: {
      meanOcrConf,
      chordLineCount: chordLines,
      lyricLineCount: lyricLines,
      chordLyricRatio: checks.chordLyricRatio.ratio,
    },
    notes,
  };
}
