// Real shell-out: degrade -> preprocess -> Tesseract. Excluded from `npm test`
// (needs magick + tesseract + eng). Run it directly:
//
//   DIGITIZE_INTEGRATION=1 npx vitest run scripts/digitize/preprocess.integration.test.ts

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { assembleChart } from "./assemble";
import { ocrPage } from "./ocr";
import { DEFAULT_PREPROCESS, preprocessPage } from "./preprocess";
import type { ManifestChart } from "./types";

const run = process.env.DIGITIZE_INTEGRATION ? describe : describe.skip;
const FIXTURES = path.join(import.meta.dirname, "__fixtures__");

run("preprocess (integration)", () => {
  it("recovers a skewed, noisy scan to the clean extraction", async () => {
    const dir = path.join(FIXTURES, "scan-skew-noise");
    const degraded = path.join(dir, "degraded.png");
    const chart = JSON.parse(
      readFileSync(path.join(dir, "manifest-entry.json"), "utf8"),
    ) as ManifestChart;

    const pre = await preprocessPage(degraded, DEFAULT_PREPROCESS, { force: true });
    expect(pre.appliedOps.some((o) => o.startsWith("deskew"))).toBe(true);
    expect(Math.abs(pre.detectedSkewDeg)).toBeGreaterThan(1.5);

    const fixed = await ocrPage(pre.pngPath, { force: true });
    expect(fixed.meanConf).toBeGreaterThan(75);

    const body = assembleChart({
      chart,
      pagesWords: [fixed.words],
      pageMeanConfs: [fixed.meanConf],
    }).chordproBody;
    // The whole point: a deskewed + denoised scan extracts to the SAME ChordPro
    // as the clean seed (committed as expected.pro / clean.tsv).
    expect(body).toBe(readFileSync(path.join(dir, "expected.pro"), "utf8"));
  }, 60_000);

  it("flattens a one-sided-lit faded photocopy (background lifts toward white)", async () => {
    const dir = path.join(FIXTURES, "scan-faded-vignette");
    const degraded = path.join(dir, "degraded.png");
    const pre = await preprocessPage(degraded, DEFAULT_PREPROCESS, { force: true });
    expect(pre.appliedOps).toContain("flatten");

    const before = await ocrPage(degraded, { force: true });
    const after = await ocrPage(pre.pngPath, { force: true });
    // Flatten + contrast should recover at least as many words as the raw scan.
    expect(after.words.length).toBeGreaterThanOrEqual(before.words.length);
  }, 60_000);
});
