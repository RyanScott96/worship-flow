// PDF -> per-page grayscale PNG (pdftoppm) + per-page WebP derivative (sharp).
// Content-addressed on the source PDF's SHA-256: a re-scanned PDF gets a fresh
// cache dir automatically; the stale one is orphaned (rm -rf .digitize-cache).

import { mkdir, readdir, readFile, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { cachePageName, rasterDir, sha8, webpCacheDir } from "./paths";
import { run } from "./sh";

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

/** Natural-sort pdftoppm output (`x-1.png`, `x-2.png`, ... or zero-padded). */
function pageNumberOf(file: string): number {
  const m = /-(\d+)\.png$/.exec(file);
  return m ? Number(m[1]) : 0;
}

/** The PDF's real page count, via poppler's `pdfinfo`. */
async function pdfPageCount(pdfPath: string): Promise<number> {
  const { stdout } = await run("pdfinfo", [pdfPath]);
  const m = /^Pages:\s+(\d+)/m.exec(stdout);
  if (!m) throw new Error(`pdfinfo returned no page count for ${pdfPath}`);
  return Number(m[1]);
}

export interface RasterizeResult {
  pdfSha: string;
  rasterDir: string;
  webpDir: string;
  pageCount: number;
}

/**
 * Rasterize `pdfPath` to `<cache>/raster/<sha8>/page-NNNN.png` and matching
 * `<cache>/webp/<sha8>/page-NNNN.webp`. Skips work already cached unless `force`.
 */
export async function rasterizePdf(
  pdfPath: string,
  dpi: number,
  opts: { force?: boolean; lastPage?: number } = {},
): Promise<RasterizeResult> {
  const bytes = await readFile(pdfPath);
  const pdfSha = sha8(bytes);
  const rDir = rasterDir(pdfSha);
  const wDir = webpCacheDir(pdfSha);

  // Only fully-normalized pages count as cached. Leftover `raw-*.png` from a
  // rename loop that was interrupted (Ctrl-C, laptop sleep) must not inflate the
  // count — they're not what `pngs` below, or any caller, reads.
  const cachedPngs = (await exists(rDir))
    ? (await readdir(rDir)).filter((f) => /^page-\d+\.png$/.test(f)).sort()
    : [];

  // Pages this call needs cached to skip pdftoppm. `lastPage` is what the caller
  // asked for, but capped at the PDF's real length: a chart whose range
  // overshoots the document (hand-authored manifest, scanner miscount) would
  // otherwise set an unreachable bar and re-rasterize the whole PDF on every
  // run. With no `lastPage` the caller wants the whole document, so the bar is
  // the real page count outright. `pdfinfo` is one ~15 ms shell-out, and only
  // `split` (no `lastPage`) pays it on a warm cache — a handful of runs ever.
  let needPages: number;
  if (cachedPngs.length === 0) {
    needPages = Number.POSITIVE_INFINITY; // nothing usable cached — must rasterize
  } else if (opts.lastPage !== undefined && cachedPngs.length >= opts.lastPage) {
    needPages = opts.lastPage; // already covered; no need to ask pdfinfo
  } else {
    const realPages = await pdfPageCount(pdfPath);
    needPages = Math.min(opts.lastPage ?? Number.POSITIVE_INFINITY, realPages);
  }
  const haveEnough = !opts.force && cachedPngs.length >= needPages;

  if (!haveEnough) {
    if (opts.force) await rm(rDir, { recursive: true, force: true });
    await mkdir(rDir, { recursive: true });

    const args = ["-png", "-gray", "-r", String(dpi)];
    if (opts.lastPage !== undefined) args.push("-l", String(opts.lastPage));
    args.push(pdfPath, path.join(rDir, "raw"));
    await run("pdftoppm", args);

    // Normalize pdftoppm's `raw-N.png` (variable zero-padding) to page-NNNN.png.
    const raw = (await readdir(rDir))
      .filter((f) => f.startsWith("raw-") && f.endsWith(".png"))
      .sort((a, b) => pageNumberOf(a) - pageNumberOf(b));
    for (const f of raw) {
      const n = pageNumberOf(f);
      await rename(path.join(rDir, f), path.join(rDir, cachePageName(n, "png")));
    }
    // Sweep any `raw-*.png` a prior interrupted run left behind that this
    // pdftoppm didn't overwrite (different zero-padding). A clean run renames
    // them all away; this keeps the cache dir to `page-*.png` only.
    for (const f of await readdir(rDir)) {
      if (/^raw-\d+\.png$/.test(f)) await rm(path.join(rDir, f));
    }
  }

  const pngs = (await readdir(rDir))
    .filter((f) => /^page-\d+\.png$/.test(f))
    .sort();

  await mkdir(wDir, { recursive: true });
  for (const png of pngs) {
    const webp = path.join(wDir, png.replace(/\.png$/, ".webp"));
    if (!opts.force && (await exists(webp))) continue;
    await sharp(path.join(rDir, png)).grayscale().webp({ quality: 80 }).toFile(webp);
  }

  return { pdfSha, rasterDir: rDir, webpDir: wDir, pageCount: pngs.length };
}
