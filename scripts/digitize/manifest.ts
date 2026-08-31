// Load and validate manifest.json. Fail loud, name the offending chart index.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { resolveKey } from "../../lib/transpose";
import type { Manifest, ManifestChart, PreprocessConfig } from "./types";

export class ManifestError extends Error {}

const BATCH_ID_RE = /^[a-z0-9][a-z0-9._-]*$/i;

function fail(msg: string): never {
  throw new ManifestError(msg);
}

function asChart(raw: unknown, i: number): ManifestChart {
  if (typeof raw !== "object" || raw === null) {
    fail(`charts[${i}] is not an object`);
  }
  const c = raw as Record<string, unknown>;
  const where = `charts[${i}]`;

  const num = (key: string): number => {
    const v = c[key];
    if (typeof v !== "number" || !Number.isFinite(v)) {
      fail(`${where}.${key} must be a number`);
    }
    return v;
  };

  const index = num("index");
  if (!Number.isInteger(index) || index < 0) {
    fail(`${where}.index must be a non-negative integer`);
  }
  const pageStart = num("pageStart");
  const pageEnd = num("pageEnd");
  if (!Number.isInteger(pageStart) || pageStart < 1) {
    fail(`${where}.pageStart must be a positive integer (1-based)`);
  }
  if (!Number.isInteger(pageEnd) || pageEnd < pageStart) {
    fail(`${where}.pageEnd must be an integer >= pageStart`);
  }
  const expectedPageCount = num("expectedPageCount");
  if (!Number.isInteger(expectedPageCount) || expectedPageCount < 1) {
    fail(`${where}.expectedPageCount must be a positive integer`);
  }

  if (c.title !== undefined && typeof c.title !== "string") {
    fail(`${where}.title must be a string`);
  }
  if (c.sourcePdf !== undefined && typeof c.sourcePdf !== "string") {
    fail(`${where}.sourcePdf must be a string`);
  }
  if (c.key !== undefined) {
    if (typeof c.key !== "string") fail(`${where}.key must be a string`);
    try {
      resolveKey(c.key);
    } catch {
      fail(`${where}.key "${c.key}" is not a key the app recognizes`);
    }
  }

  return {
    index,
    title: c.title as string | undefined,
    pageStart,
    pageEnd,
    expectedPageCount,
    sourcePdf: c.sourcePdf as string | undefined,
    key: c.key as string | undefined,
  };
}

export function parseManifest(json: unknown, baseDir: string): Manifest {
  if (typeof json !== "object" || json === null) {
    fail("manifest is not a JSON object");
  }
  const m = json as Record<string, unknown>;

  if (typeof m.batchId !== "string" || !BATCH_ID_RE.test(m.batchId)) {
    fail("batchId is required and must match /^[a-z0-9][a-z0-9._-]*$/i");
  }
  if (m.sourcePdf !== undefined && typeof m.sourcePdf !== "string") {
    fail("sourcePdf must be a string");
  }
  let dpi = 300;
  if (m.dpi !== undefined) {
    if (typeof m.dpi !== "number" || !Number.isInteger(m.dpi) || m.dpi < 72) {
      fail("dpi must be an integer >= 72");
    }
    dpi = m.dpi;
  }
  if (!Array.isArray(m.charts) || m.charts.length === 0) {
    fail("charts must be a non-empty array");
  }

  let confFloor: number | undefined;
  if (m.confFloor !== undefined) {
    if (typeof m.confFloor !== "number" || m.confFloor < 0 || m.confFloor > 100) {
      fail("confFloor must be a number in 0..100");
    }
    confFloor = m.confFloor;
  }

  let preprocess: PreprocessConfig | undefined;
  if (m.preprocess !== undefined) {
    if (typeof m.preprocess !== "object" || m.preprocess === null) {
      fail("preprocess must be an object");
    }
    const pp = m.preprocess as Record<string, unknown>;
    const mode = pp.mode ?? "auto";
    if (mode !== "auto" && mode !== "on" && mode !== "off") {
      fail('preprocess.mode must be "auto", "on" or "off"');
    }
    const bool = (k: string, dflt: boolean) =>
      pp[k] === undefined ? dflt : pp[k] === true;
    preprocess = {
      mode,
      deskew: bool("deskew", true),
      flatten: bool("flatten", true),
      contrastStretch: bool("contrastStretch", true),
      despeckle: bool("despeckle", true),
    };
  }

  const charts = m.charts.map(asChart);

  const seen = new Set<number>();
  for (const c of charts) {
    if (seen.has(c.index)) fail(`duplicate chart index ${c.index}`);
    seen.add(c.index);
    if (!c.sourcePdf && !m.sourcePdf) {
      fail(`charts with index ${c.index} has no sourcePdf and no batch sourcePdf`);
    }
  }

  return {
    batchId: m.batchId,
    sourcePdf: m.sourcePdf as string | undefined,
    dpi,
    charts,
    baseDir,
    preprocess,
    confFloor,
  };
}

export async function loadManifest(manifestPath: string): Promise<Manifest> {
  const abs = path.resolve(manifestPath);
  let text: string;
  try {
    text = await readFile(abs, "utf8");
  } catch {
    fail(`cannot read manifest at ${abs}`);
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (err) {
    fail(`manifest is not valid JSON: ${(err as Error).message}`);
  }
  return parseManifest(json, path.dirname(abs));
}

/** Resolve a chart's source PDF to an absolute path (chart override wins). */
export function chartSourcePdf(manifest: Manifest, chart: ManifestChart): string {
  const rel = chart.sourcePdf ?? manifest.sourcePdf;
  if (!rel) {
    // parseManifest guarantees this, but keep the invariant local.
    throw new ManifestError(`charts[${chart.index}] has no source PDF`);
  }
  return path.resolve(manifest.baseDir, rel);
}
