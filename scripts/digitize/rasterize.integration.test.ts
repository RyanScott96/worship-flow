// Real shell-out: magick makes a multi-page PDF, poppler rasterizes it.
// Excluded from `npm test` (needs magick + poppler). Run it directly:
//
//   DIGITIZE_INTEGRATION=1 npx vitest run scripts/digitize/rasterize.integration.test.ts

import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { rasterDir, sha8, webpCacheDir } from "./paths";
import { rasterizePdf } from "./rasterize";
import { run } from "./sh";

const suite = process.env.DIGITIZE_INTEGRATION ? describe : describe.skip;

suite("rasterizePdf (integration)", () => {
  it("a partial cache from an earlier lastPage run doesn't truncate a later whole-document run", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "raster-int-"));
    const pdf = path.join(dir, "three-pages.pdf");
    // 3 distinct pages -> a 3-page PDF.
    await run("magick", [
      "-size", "300x400", "xc:white", "xc:gray90", "xc:white", pdf,
    ]);
    const sha = sha8(await readFile(pdf));

    try {
      // First run only needs page 1 — cache ends up with a single page.
      const partial = await rasterizePdf(pdf, 72, { lastPage: 1 });
      expect(partial.pageCount).toBe(1);

      // Whole-document run against that non-empty-but-partial cache: must
      // rasterize the rest, not report the stale count of 1.
      const full = await rasterizePdf(pdf, 72, {});
      expect(full.pageCount).toBe(3);
    } finally {
      await rm(rasterDir(sha), { recursive: true, force: true });
      await rm(webpCacheDir(sha), { recursive: true, force: true });
      await rm(dir, { recursive: true, force: true });
    }
  }, 60_000);
});
