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

  const cachedPngs = (await exists(rDir))
    ? (await readdir(rDir)).filter((f) => f.endsWith(".png")).sort()
    : [];
  const haveEnough =
    !opts.force &&
    cachedPngs.length > 0 &&
    (opts.lastPage === undefined || cachedPngs.length >= opts.lastPage);

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
