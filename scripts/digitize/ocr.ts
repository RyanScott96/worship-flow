// PNG page -> Tesseract TSV (word boxes) -> parsed OcrWord[]. Cached by the
// PNG's content SHA-256, so re-running `extract` after tuning the heuristics
// never re-OCRs (Tesseract is the slow step; D-08 "re-run many times").

import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseTsv } from "./lines";
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

/** OCR one PNG. `psm` 4 = "single column of text of variable sizes". */
export async function ocrPage(
  pngPath: string,
  opts: { force?: boolean; psm?: number } = {},
): Promise<OcrPageResult> {
  const bytes = await readFile(pngPath);
  const key = sha8(bytes);
  const dir = ocrDir();
  await mkdir(dir, { recursive: true });
  const tsvPath = path.join(dir, `${key}.tsv`);
  const wordsPath = path.join(dir, `${key}.words.json`);

  let tsv: string;
  if (!opts.force && (await exists(tsvPath))) {
    tsv = await readFile(tsvPath, "utf8");
  } else {
    const { stdout } = await run("tesseract", [
      pngPath,
      "stdout",
      "--psm",
      String(opts.psm ?? 4),
      "tsv",
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
