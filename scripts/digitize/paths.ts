// Filesystem layout for the pipeline. Everything the operator manages lives in
// `scans/`; everything the pipeline generates lives in `.digitize-cache/`
// (safe to delete) and `out/<batchId>/` (the run artifact). All three are
// git-ignored.

import { createHash } from "node:crypto";
import path from "node:path";

/** Same rule as the app's .pro export route (app/songs/.../export/route.ts). */
export function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "song"
  );
}

/** First 8 hex chars of the SHA-256 of a buffer — the content-address cache key. */
export function sha8(buf: Buffer | string): string {
  return createHash("sha256").update(buf).digest("hex").slice(0, 8);
}

/** Repo root — this file is at <root>/scripts/digitize/paths.ts. */
export const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");

export const CACHE_DIR = path.join(REPO_ROOT, ".digitize-cache");
export const OUT_DIR = path.join(REPO_ROOT, "out");

export const rasterDir = (pdfSha: string) =>
  path.join(CACHE_DIR, "raster", pdfSha);
export const webpCacheDir = (pdfSha: string) =>
  path.join(CACHE_DIR, "webp", pdfSha);
export const ocrDir = () => path.join(CACHE_DIR, "ocr");

/** Cache page file, e.g. `page-0007.png` — source-PDF page, zero-padded to 4. */
export const cachePageName = (n: number, ext: string) =>
  `page-${String(n).padStart(4, "0")}.${ext}`;

/** Per-song page file, e.g. `page-02.webp` — 1-based within the song. */
export const songPageName = (n: number) => `page-${String(n).padStart(2, "0")}.webp`;

export const batchOutDir = (batchId: string) => path.join(OUT_DIR, batchId);
export const chartScanDir = (batchId: string, slug: string) =>
  path.join(batchOutDir(batchId), "scans", slug);

/** Paths stored in the DB — relative, POSIX separators; base resolved later. */
export const relScanPdf = (slug: string) => `scans/${slug}/original.pdf`;
export const relScanPage = (slug: string, pageNumber: number) =>
  `scans/${slug}/${songPageName(pageNumber)}`;
