// Parse Tesseract TSV into words, then group words into lines. Everything
// downstream works on these boxes — never on flattened text (docs/DOMAIN.md §7).

import type { OcrLine, OcrWord } from "./types";

const TSV_COLUMNS = [
  "level",
  "page_num",
  "block_num",
  "par_num",
  "line_num",
  "word_num",
  "left",
  "top",
  "width",
  "height",
  "conf",
  "text",
] as const;

/**
 * Parse `tesseract <img> stdout tsv` output. Keeps only word rows (level 5)
 * with non-empty text. Low-confidence words are kept — they still carry a box.
 */
export function parseTsv(tsv: string): OcrWord[] {
  const rows = tsv.split(/\r?\n/).filter((r) => r.length > 0);
  if (rows.length === 0) return [];

  const header = rows[0].split("\t");
  const looksLikeHeader = header[0] === "level";
  const start = looksLikeHeader ? 1 : 0;
  if (looksLikeHeader && header.length !== TSV_COLUMNS.length) {
    throw new Error(
      `unexpected Tesseract TSV header: ${header.length} columns, expected ${TSV_COLUMNS.length}`,
    );
  }

  const words: OcrWord[] = [];
  for (let i = start; i < rows.length; i++) {
    const cols = rows[i].split("\t");
    if (cols.length < TSV_COLUMNS.length) continue;
    const level = Number(cols[0]);
    if (level !== 5) continue;
    const text = cols[11] ?? "";
    if (text.trim() === "") continue;
    const conf = Number(cols[10]);
    if (!Number.isFinite(conf) || conf < 0) continue;

    words.push({
      page: Number(cols[1]),
      block: Number(cols[2]),
      par: Number(cols[3]),
      line: Number(cols[4]),
      word: Number(cols[5]),
      left: Number(cols[6]),
      top: Number(cols[7]),
      width: Number(cols[8]),
      height: Number(cols[9]),
      conf,
      text,
    });
  }
  return words;
}

function makeLine(words: OcrWord[]): OcrLine {
  const sorted = [...words].sort((a, b) => a.left - b.left);
  const xLeft = Math.min(...sorted.map((w) => w.left));
  const xRight = Math.max(...sorted.map((w) => w.left + w.width));
  const yTop = Math.min(...sorted.map((w) => w.top));
  const yBottom = Math.max(...sorted.map((w) => w.top + w.height));
  const meanConf =
    sorted.reduce((s, w) => s + w.conf, 0) / Math.max(sorted.length, 1);
  return {
    key: `${sorted[0].block}.${sorted[0].par}.${sorted[0].line}`,
    words: sorted,
    xLeft,
    xRight,
    yTop,
    yBottom,
    yMid: (yTop + yBottom) / 2,
    height: yBottom - yTop,
    text: sorted.map((w) => w.text).join(" "),
    meanConf,
  };
}

function verticalOverlap(a: OcrLine, b: OcrLine): number {
  return Math.max(0, Math.min(a.yBottom, b.yBottom) - Math.max(a.yTop, b.yTop));
}

function horizontallyDisjoint(a: OcrLine, b: OcrLine): boolean {
  return a.xRight <= b.xLeft || b.xRight <= a.xLeft;
}

/**
 * Group words into lines by Tesseract's own (block, par, line) segmentation,
 * then merge fragments a sparse chord row was split into: two lines that
 * overlap vertically by > 60% of the smaller height and don't overlap
 * horizontally are the same visual line.
 */
export function groupLines(words: OcrWord[]): OcrLine[] {
  const byKey = new Map<string, OcrWord[]>();
  for (const w of words) {
    const k = `${w.block}.${w.par}.${w.line}`;
    const bucket = byKey.get(k);
    if (bucket) bucket.push(w);
    else byKey.set(k, [w]);
  }

  let lines = [...byKey.values()].map(makeLine).sort((a, b) => a.yTop - b.yTop);

  const merged: OcrLine[] = [];
  for (const line of lines) {
    const prev = merged[merged.length - 1];
    if (
      prev &&
      verticalOverlap(prev, line) > 0.6 * Math.min(prev.height, line.height) &&
      horizontallyDisjoint(prev, line)
    ) {
      merged[merged.length - 1] = makeLine([...prev.words, ...line.words]);
    } else {
      merged.push(line);
    }
  }
  lines = merged;

  return lines;
}

export interface PageMetrics {
  medianLineHeight: number;
  medianLineGap: number;
  maxLineHeight: number;
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function pageMetrics(lines: OcrLine[]): PageMetrics {
  const heights = lines.map((l) => l.height).filter((h) => h > 0);
  const gaps: number[] = [];
  for (let i = 1; i < lines.length; i++) {
    gaps.push(Math.max(0, lines[i].yTop - lines[i - 1].yBottom));
  }
  return {
    medianLineHeight: median(heights),
    medianLineGap: median(gaps),
    maxLineHeight: heights.length ? Math.max(...heights) : 0,
  };
}
