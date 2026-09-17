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

/**
 * Cheap, deliberately conservative "does this page look like two side-by-side
 * columns" check, run on the initial `--psm 4` OCR pass to decide whether a
 * page is worth re-OCRing with `--psm 3` (see `ocr.ts`). `--psm 4` assumes a
 * single column and reads straight across a real two-column chart, so a
 * genuine gutter shows up as an outsized gap in the pooled, sorted word
 * left-edges -- roughly centred, with real content on both sides, not just
 * normal word-to-word spacing.
 *
 * Tuned against the real pilot batch to have zero false positives on single-
 * column charts (including a noisy/skewed one) at the cost of missing some
 * genuine two-column pages whose columns are less sharply separated -- a
 * missed page just keeps today's `--psm 4` behavior, so false negatives are
 * far cheaper than false positives here.
 */
export function looksMultiColumn(words: OcrWord[]): boolean {
  if (words.length < 6) return false;
  const lefts = words.map((w) => w.left).sort((a, b) => a - b);
  const min = lefts[0];
  const max = Math.max(...words.map((w) => w.left + w.width));
  const span = max - min;
  if (span <= 0) return false;

  let bestGap = 0;
  let bestX = -1;
  for (let i = 1; i < lefts.length; i++) {
    const gap = lefts[i] - lefts[i - 1];
    const mid = (lefts[i] + lefts[i - 1]) / 2;
    const frac = (mid - min) / span;
    if (frac > 0.15 && frac < 0.6 && gap > bestGap) {
      bestGap = gap;
      bestX = mid;
    }
  }
  if (bestX < 0 || bestGap / span < 0.08) return false;

  const leftCount = lefts.filter((x) => x < bestX).length;
  const rightCount = lefts.length - leftCount;
  return leftCount >= lefts.length * 0.25 && rightCount >= lefts.length * 0.25;
}

function verticalOverlap(a: OcrLine, b: OcrLine): number {
  return Math.max(0, Math.min(a.yBottom, b.yBottom) - Math.max(a.yTop, b.yTop));
}

function horizontallyDisjoint(a: OcrLine, b: OcrLine): boolean {
  return a.xRight <= b.xLeft || b.xRight <= a.xLeft;
}

/**
 * Merge fragments a sparse chord row was split into: two lines that overlap
 * vertically by > 60% of the smaller height and don't overlap horizontally
 * are the same visual line. Only ever called within a single Tesseract
 * block (see `groupLines`) -- two lines from *different* columns at similar
 * y satisfy this exact same test, so merging across a block boundary would
 * silently glue a two-column chart's columns back together.
 */
function mergeFragments(sortedByY: OcrLine[]): OcrLine[] {
  const merged: OcrLine[] = [];
  for (const line of sortedByY) {
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
  return merged;
}

const sortByY = (a: OcrLine, b: OcrLine) => a.yTop - b.yTop;

interface Block {
  xLeft: number;
  xRight: number;
  yTop: number;
  yBottom: number;
  lines: OcrLine[];
}

function toBlock(lines: OcrLine[]): Block {
  return {
    xLeft: Math.min(...lines.map((l) => l.xLeft)),
    xRight: Math.max(...lines.map((l) => l.xRight)),
    yTop: Math.min(...lines.map((l) => l.yTop)),
    yBottom: Math.max(...lines.map((l) => l.yBottom)),
    lines,
  };
}

/**
 * Order a page's Tesseract blocks the way a person reads a two-column chart:
 * top matter (title, credits) top to bottom, then the whole left column top
 * to bottom, then the whole right column, then bottom matter (copyright).
 * Reading strictly by y (as a single-column page can) would interleave the
 * two columns' rows instead.
 *
 * Blocks wide enough to span both columns (title/credits/copyright lines)
 * are never bucketed into a column; the rest are split into two columns by
 * the gap between their own x-positions -- a few dozen blocks at most, so
 * this is a much cleaner signal than the same idea run on individual words
 * (see `looksMultiColumn`). Falls back to a plain y-sort whenever the page
 * doesn't actually look like two columns of blocks.
 */
function columnMajorOrder(blocks: Block[]): OcrLine[] {
  const byY = () => blocks.flatMap((b) => b.lines).sort(sortByY);
  if (blocks.length < 2) return byY();

  const pageLeft = Math.min(...blocks.map((b) => b.xLeft));
  const pageRight = Math.max(...blocks.map((b) => b.xRight));
  const pageSpan = pageRight - pageLeft;
  if (pageSpan <= 0) return byY();

  const spanning = blocks.filter((b) => (b.xRight - b.xLeft) / pageSpan > 0.6);
  const candidates = blocks.filter((b) => !spanning.includes(b));
  if (candidates.length < 2) return byY();

  const lefts = candidates.map((b) => b.xLeft).sort((a, b) => a - b);
  let bestGap = 0;
  let boundary = -1;
  for (let i = 1; i < lefts.length; i++) {
    const gap = lefts[i] - lefts[i - 1];
    if (gap > bestGap) {
      bestGap = gap;
      boundary = (lefts[i] + lefts[i - 1]) / 2;
    }
  }
  if (boundary < 0 || bestGap / pageSpan < 0.15) return byY();

  const left = candidates.filter((b) => b.xLeft < boundary);
  const right = candidates.filter((b) => b.xLeft >= boundary);
  if (left.length === 0 || right.length === 0) return byY();

  const colTop = Math.min(...left.map((b) => b.yTop), ...right.map((b) => b.yTop));
  const colBottom = Math.max(...left.map((b) => b.yBottom), ...right.map((b) => b.yBottom));

  // A block that doesn't actually sit in the two-column band -- e.g. a
  // narrow logo above both columns that happens to fall on the right side of
  // the x boundary -- belongs with the spanning top/bottom matter instead.
  const outside = [...left, ...right].filter(
    (b) => b.yBottom <= colTop || b.yTop >= colBottom,
  );
  const inColumn = (b: Block) => !outside.includes(b);

  const before = [...spanning, ...outside].filter((b) => b.yTop < colTop);
  const after = [...spanning, ...outside].filter((b) => b.yTop >= colTop && !before.includes(b));

  return [
    ...before.sort((a, b) => a.yTop - b.yTop).flatMap((b) => b.lines),
    ...left.filter(inColumn).flatMap((b) => b.lines),
    ...right.filter(inColumn).flatMap((b) => b.lines),
    ...after.sort((a, b) => a.yTop - b.yTop).flatMap((b) => b.lines),
  ];
}

/**
 * Group words into lines by Tesseract's own (block, par, line) segmentation,
 * then merge same-block fragments a sparse chord row was split into, then
 * order blocks the way a person reads a two-column page (see
 * `columnMajorOrder`).
 *
 * On a page `ocr.ts` OCR'd at `--psm 3` (its auto-detected multi-column
 * path), layout analysis puts each real page column in its own block; at the
 * default `--psm 4` everything is block 1, so both the merge guard and the
 * column ordering below are no-ops and this behaves exactly as it always
 * has. The fragment-merge has to respect the block boundary when there is
 * one -- done per block, not on the whole page's lines at once, so a
 * same-block fragment pair is never separated by an other-block line that
 * happens to sort between them by y.
 */
export function groupLines(words: OcrWord[]): OcrLine[] {
  const byKey = new Map<string, OcrWord[]>();
  for (const w of words) {
    const k = `${w.block}.${w.par}.${w.line}`;
    const bucket = byKey.get(k);
    if (bucket) bucket.push(w);
    else byKey.set(k, [w]);
  }

  const byBlock = new Map<number, OcrLine[]>();
  for (const line of [...byKey.values()].map(makeLine)) {
    const block = line.words[0].block;
    const bucket = byBlock.get(block);
    if (bucket) bucket.push(line);
    else byBlock.set(block, [line]);
  }

  const blocks = [...byBlock.values()].map((blockLines) =>
    toBlock(mergeFragments(blockLines.sort(sortByY))),
  );
  return columnMajorOrder(blocks);
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
