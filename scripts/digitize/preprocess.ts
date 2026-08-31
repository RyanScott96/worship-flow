// Image preprocessing for OCR input only — deskew, background flatten, gentle
// contrast, despeckle. Runs BETWEEN rasterize and OCR. The viewer WebP is built
// in rasterize.ts from the RAW grayscale raster and is not touched here, because
// D-05 corrections are made against the scan the human sees.
//
// Grayscale in, grayscale out. No -threshold / -monochrome / -lat / -type
// Bilevel anywhere — D-05 (preserve pencil annotations).

import { copyFile, mkdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { preprocDir, sha8 } from "./paths";
import {
  AUTO_FLATTEN_QUADRANT_SPREAD,
  AUTO_FLATTEN_STDDEV,
  AUTO_SKEW_SKIP_DEG,
  DESKEW_THRESHOLD,
} from "./quality";
import { run } from "./sh";
import type { PreprocessConfig } from "./types";

export const DEFAULT_PREPROCESS: PreprocessConfig = {
  mode: "auto",
  deskew: true,
  flatten: true,
  contrastStretch: true,
  despeckle: true,
};

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

interface Probe {
  skewDeg: number;
  pageMean: number; // 0..1
  stdDev: number; // 0..1
  quadrantSpread: number; // max-min of the four quadrant means
}

async function probe(srcPng: string): Promise<Probe> {
  // `%[deskew:angle]` is only populated after `-deskew` runs; `info:` means the
  // rotated image is never written, so this is a cheap angle probe.
  const { stdout: a } = await run("magick", [
    srcPng,
    "-colorspace",
    "Gray",
    "-deskew",
    DESKEW_THRESHOLD,
    "-format",
    "%[deskew:angle]",
    "info:",
  ]);
  const skew = Number(a.trim());

  const { stdout: b } = await run("magick", [
    srcPng,
    "-colorspace",
    "Gray",
    "-format",
    "%[fx:mean]|%[fx:standard_deviation]",
    "info:",
  ]);
  const [mean, std] = b.trim().split("|").map(Number);

  const { stdout: q } = await run("magick", [
    srcPng,
    "-colorspace",
    "Gray",
    "-crop",
    "2x2@",
    "+repage",
    "-format",
    "%[fx:mean]\n",
    "info:",
  ]);
  const means = q.trim().split(/\s+/).map(Number).filter((n) => Number.isFinite(n));
  const spread = means.length ? Math.max(...means) - Math.min(...means) : 0;

  return {
    skewDeg: Number.isFinite(skew) ? skew : 0,
    pageMean: Number.isFinite(mean) ? mean : 1,
    stdDev: Number.isFinite(std) ? std : 0,
    quadrantSpread: spread,
  };
}

interface Plan {
  deskew: boolean;
  flatten: boolean;
  contrastStretch: boolean;
  despeckle: boolean;
}

function planFor(cfg: PreprocessConfig, p: Probe): Plan {
  if (cfg.mode === "on") {
    return {
      deskew: cfg.deskew && Math.abs(p.skewDeg) >= AUTO_SKEW_SKIP_DEG,
      flatten: cfg.flatten,
      contrastStretch: cfg.contrastStretch,
      despeckle: cfg.despeckle,
    };
  }
  // auto: apply only what the page needs.
  const uneven = p.quadrantSpread >= AUTO_FLATTEN_QUADRANT_SPREAD;
  const faded = p.pageMean < 0.9;
  const noisy = uneven && p.stdDev > AUTO_FLATTEN_STDDEV + 0.09;
  return {
    deskew: cfg.deskew && Math.abs(p.skewDeg) >= AUTO_SKEW_SKIP_DEG,
    flatten: cfg.flatten && uneven,
    contrastStretch: cfg.contrastStretch && (uneven || faded),
    despeckle: cfg.despeckle && noisy,
  };
}

function opArgs(plan: Plan): string[] {
  const args: string[] = ["-colorspace", "Gray"];
  if (plan.deskew) {
    args.push("-background", "white", "-deskew", DESKEW_THRESHOLD, "+repage");
  }
  if (plan.flatten) {
    args.push("(", "+clone", "-blur", "0x50", ")", "-compose", "Divide", "-composite", "-auto-level");
  }
  if (plan.contrastStretch) args.push("-contrast-stretch", "0.5%x0.5%");
  if (plan.despeckle) args.push("-despeckle");
  args.push("-depth", "8");
  return args;
}

export interface PreprocessResult {
  pngPath: string;
  appliedOps: string[];
  detectedSkewDeg: number;
}

/**
 * Preprocess one raster PNG for OCR. Cached on the raw bytes + the config, so a
 * config change re-OCRs only affected pages (ocr.ts keys on the bytes it's
 * handed). Returns the source path unchanged when nothing needs doing — this is
 * what keeps born-digital PDFs byte-identical.
 */
export async function preprocessPage(
  srcPng: string,
  cfg: PreprocessConfig,
  opts: { force?: boolean } = {},
): Promise<PreprocessResult> {
  if (cfg.mode === "off") {
    return { pngPath: srcPng, appliedOps: [], detectedSkewDeg: 0 };
  }

  const srcBytes = await readFile(srcPng);
  const key = sha8(
    Buffer.concat([srcBytes, Buffer.from(JSON.stringify(cfg))]),
  );
  const dir = preprocDir(key);
  const dst = path.join(dir, path.basename(srcPng));

  const p = await probe(srcPng);
  const plan = planFor(cfg, p);
  const applied: string[] = [];
  if (plan.deskew) applied.push(`deskew(${p.skewDeg.toFixed(2)}°)`);
  if (plan.flatten) applied.push("flatten");
  if (plan.contrastStretch) applied.push("contrast-stretch");
  if (plan.despeckle) applied.push("despeckle");

  if (applied.length === 0) {
    return { pngPath: srcPng, appliedOps: [], detectedSkewDeg: p.skewDeg };
  }

  if (!opts.force && (await exists(dst))) {
    return { pngPath: dst, appliedOps: applied, detectedSkewDeg: p.skewDeg };
  }

  await mkdir(dir, { recursive: true });
  // magick reads srcPng first, applies the op chain, writes dst. If deskew alone
  // is planned we still round-trip through magick — acceptable, it's a real op.
  await run("magick", [srcPng, ...opArgs(plan), dst]);
  // Belt-and-braces: if magick somehow produced nothing, fall back to the source.
  if (!(await exists(dst))) {
    await copyFile(srcPng, dst);
  }
  return { pngPath: dst, appliedOps: applied, detectedSkewDeg: p.skewDeg };
}
