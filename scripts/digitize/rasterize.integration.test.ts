// Real shell-out: magick makes a multi-page PDF, poppler rasterizes it.
// Excluded from `npm test` (needs magick + poppler). Run it directly:
//
//   DIGITIZE_INTEGRATION=1 npx vitest run scripts/digitize/rasterize.integration.test.ts

import { mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cachePageName, rasterDir, sha8, webpCacheDir } from "./paths";
import { rasterizePdf } from "./rasterize";
import { run } from "./sh";

const suite = process.env.DIGITIZE_INTEGRATION ? describe : describe.skip;

/** A `pages`-page PDF in a fresh temp dir. */
async function makePdf(pages: number): Promise<{ dir: string; pdf: string; sha: string }> {
  const dir = await mkdtemp(path.join(tmpdir(), "raster-int-"));
  const pdf = path.join(dir, `${pages}-pages.pdf`);
  const swatches = Array.from({ length: pages }, (_, i) =>
    i % 2 ? "xc:gray90" : "xc:white",
  );
  await run("magick", ["-size", "300x400", ...swatches, pdf]);
  return { dir, pdf, sha: sha8(await readFile(pdf)) };
}

suite("rasterizePdf (integration)", () => {
  it("a partial cache from an earlier lastPage run doesn't truncate a later whole-document run", async () => {
    const { dir, pdf, sha } = await makePdf(3);
    try {
      const partial = await rasterizePdf(pdf, 72, { lastPage: 1 });
      expect(partial.pageCount).toBe(1);

      const full = await rasterizePdf(pdf, 72, {});
      expect(full.pageCount).toBe(3);
    } finally {
      await rm(rasterDir(sha), { recursive: true, force: true });
      await rm(webpCacheDir(sha), { recursive: true, force: true });
      await rm(dir, { recursive: true, force: true });
    }
  }, 60_000);

  it("leftover raw-*.png from an interrupted rename loop doesn't count as cached pages", async () => {
    const { dir, pdf, sha } = await makePdf(3);
    try {
      await rasterizePdf(pdf, 72, {}); // full cache: page-0001..0003
      const rDir = rasterDir(sha);

      // Simulate a rename loop killed after page 2: page 3 never got normalized,
      // and a stray raw-3.png is still sitting there.
      await rm(path.join(rDir, cachePageName(3, "png")));
      await writeFile(path.join(rDir, "raw-3.png"), "not a real png");

      // Old code counted the raw file, saw 3 >= 3, and returned pageCount 2.
      const again = await rasterizePdf(pdf, 72, {});
      expect(again.pageCount).toBe(3);
      expect((await readdir(rDir)).some((f) => f.startsWith("raw-"))).toBe(false);
    } finally {
      await rm(rasterDir(sha), { recursive: true, force: true });
      await rm(webpCacheDir(sha), { recursive: true, force: true });
      await rm(dir, { recursive: true, force: true });
    }
  }, 60_000);

  it("a lastPage past the end of the PDF is satisfied by a complete cache, not re-rasterized forever", async () => {
    const { dir, pdf, sha } = await makePdf(3);
    try {
      const first = await rasterizePdf(pdf, 72, { lastPage: 3 });
      expect(first.pageCount).toBe(3);

      const p1 = path.join(rasterDir(sha), cachePageName(1, "png"));
      const mtimeBefore = (await stat(p1)).mtimeMs;
      await new Promise((r) => setTimeout(r, 50));

      // lastPage 10 on a 3-page PDF: old code's bar (10) was never reachable, so
      // pdftoppm re-ran on every call. Now it's capped at the real count.
      const again = await rasterizePdf(pdf, 72, { lastPage: 10 });
      expect(again.pageCount).toBe(3);
      expect((await stat(p1)).mtimeMs).toBe(mtimeBefore); // cache reused, not rebuilt
    } finally {
      await rm(rasterDir(sha), { recursive: true, force: true });
      await rm(webpCacheDir(sha), { recursive: true, force: true });
      await rm(dir, { recursive: true, force: true });
    }
  }, 60_000);
});
