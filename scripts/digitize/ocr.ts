// PNG page -> Tesseract TSV (word boxes) -> parsed OcrWord[]. Cached by the
// PNG's content SHA-256, so re-running `extract` after tuning the heuristics
// never re-OCRs (Tesseract is the slow step; D-08 "re-run many times").

import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { looksMultiColumn, parseTsv } from "./lines";
import { ocrDir, sha8 } from "./paths";
import { run } from "./sh";
import type { OcrWord } from "./types";

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

export interface OcrPageResult {
  words: OcrWord[];
  /** Mean confidence across kept words, 0..100 (0 when the page is empty). */
  meanConf: number;
  tsvPath: string;
}

/**
 * One raw `tesseract` shell-out + cache read/write for a single (png, psm)
 * pair. Cache key includes `psm` -- the auto-detect path in `ocrPage` below
 * can run this twice for the same PNG with different psm values, and they
 * must not collide.
 */
async function runTesseract(
  pngPath: string,
  psm: number,
  opts: { force?: boolean },
): Promise<{ words: OcrWord[]; meanConf: number; tsvPath: string }> {
  const bytes = await readFile(pngPath);
  const key = sha8(bytes);
  const dir = ocrDir();
  await mkdir(dir, { recursive: true });
  const tsvPath = path.join(dir, `${key}.psm${psm}.tsv`);
  const wordsPath = path.join(dir, `${key}.psm${psm}.words.json`);

  let tsv: string;
  if (!opts.force && (await exists(tsvPath))) {
    tsv = await readFile(tsvPath, "utf8");
  } else {
    // --oem 1: LSTM only (the implicit default 3 falls back to the worse legacy
    //   engine).
    // -c tessedit_create_tsv=1 (not the `tsv` config file) is what actually
    //   streams the 12-column word TSV to stdout on Tesseract 5; the config-file
    //   form writes a `stdout.tsv` and prints plain text instead.
    // -c preserve_interword_spaces=1: the splice reconstructs x-positions from
    //   word boxes and gaps — faithful spacing helps.
    // No char whitelist/blacklist: it would kill 7 / 9 / sus4 / add9 / "Capo 3".
    const { stdout } = await run("tesseract", [
      pngPath,
      "stdout",
      "--oem",
      "1",
      "--psm",
      String(psm),
      "-c",
      "preserve_interword_spaces=1",
      "-c",
      "tessedit_create_tsv=1",
    ]);
    tsv = stdout;
    await writeFile(tsvPath, tsv, "utf8");
  }

  const words = parseTsv(tsv);
  await writeFile(wordsPath, JSON.stringify(words), "utf8");

  const meanConf =
    words.length === 0
      ? 0
      : words.reduce((s, w) => s + w.conf, 0) / words.length;

  return { words, meanConf, tsvPath };
}

/**
 * OCR one PNG. `psm` 4 = "single column of variable-size text" -- right for
 * the common case, a chord chart's chord/lyric size mix within one column.
 * Wrong for a genuine two-column chart (common enough in real chart
 * libraries -- church SongSelect/Bethel-style lead sheets): it reads
 * straight across both columns and tags words from both as the same line
 * whenever they land at similar y.
 *
 * Callers that don't pin a `psm` get this auto-detect: OCR at `psm` 4 first,
 * and only if the result `looksMultiColumn` (see lines.ts) re-OCR at `psm` 3
 * ("fully automatic page segmentation", real column-aware layout analysis)
 * and use that instead. `looksMultiColumn` is tuned to never fire on a
 * single-column page, so this never risks psm 3 regressing the common case
 * -- it only spends a second OCR pass on pages that already look suspicious.
 */
export async function ocrPage(
  pngPath: string,
  opts: { force?: boolean; psm?: number } = {},
): Promise<OcrPageResult> {
  if (opts.psm != null) return runTesseract(pngPath, opts.psm, opts);

  const first = await runTesseract(pngPath, 4, opts);
  if (!looksMultiColumn(first.words)) return first;
  return runTesseract(pngPath, 3, opts);
}
