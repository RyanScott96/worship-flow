// One-time digitization CLI (docs/ROADMAP.md Phase 1.5). Hand-rolled arg
// parsing, like db/migrate.mjs — no dependency for six subcommands.
//
//   npm run digitize doctor
//   npm run digitize rasterize   [--manifest path] [--force]
//   npm run digitize ocr         [--manifest path] [--force] [--psm N]
//   npm run digitize report      [--manifest path] [--only 0-19]
//   npm run digitize extract     [--manifest path] [--only ...] [--force] [--apply]
//   npm run digitize:dev import  [--manifest path] [--yes]

import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { getSql } from "../../lib/db/client";
import { ArrangementValidationError } from "../../lib/db/validation";
import {
  importChartRecord,
  type ImportableChart,
  type SongMatch,
} from "../../lib/db/digitization";
import { doctor } from "./doctor";
import { runExtract } from "./extract";
import { chartSourcePdf, loadManifest, ManifestError } from "./manifest";
import { ocrPage } from "./ocr";
import { batchOutDir, cachePageName, rasterDir } from "./paths";
import { DEFAULT_PREPROCESS, preprocessPage } from "./preprocess";
import { rasterizePdf } from "./rasterize";
import type { ChartRecord, Manifest, PreprocessConfig } from "./types";

interface Args {
  cmd: string;
  manifest: string;
  force: boolean;
  apply: boolean;
  yes: boolean;
  dryRun: boolean;
  psm?: number;
  only?: Set<number>;
  preprocessMode?: "auto" | "on" | "off";
  noDeskew: boolean;
  confFloor?: number;
}

function parseArgs(argv: string[]): Args {
  const a: Args = {
    cmd: argv[0] ?? "",
    manifest: "./scans/manifest.json",
    force: false,
    apply: false,
    yes: false,
    dryRun: false,
    noDeskew: false,
  };
  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--manifest") a.manifest = argv[++i];
    else if (arg === "--force") a.force = true;
    else if (arg === "--apply") a.apply = true;
    else if (arg === "--yes") a.yes = true;
    else if (arg === "--dry-run") a.dryRun = true;
    else if (arg === "--psm") a.psm = Number(argv[++i]);
    else if (arg === "--only") a.only = parseOnly(argv[++i]);
    else if (arg === "--preprocess") {
      const m = argv[++i];
      if (m !== "auto" && m !== "on" && m !== "off") {
        throw new Error(`--preprocess must be auto|on|off, got ${m}`);
      }
      a.preprocessMode = m;
    } else if (arg === "--no-deskew") a.noDeskew = true;
    else if (arg === "--conf-floor") a.confFloor = Number(argv[++i]);
    else throw new Error(`unknown argument: ${arg}`);
  }
  return a;
}

/** CLI flags -> a PreprocessConfig, or undefined to fall back to manifest/default. */
function preprocessFromArgs(a: Args): PreprocessConfig | undefined {
  if (!a.preprocessMode && !a.noDeskew) return undefined;
  return {
    ...DEFAULT_PREPROCESS,
    mode: a.preprocessMode ?? DEFAULT_PREPROCESS.mode,
    deskew: !a.noDeskew,
  };
}

/** "0-19" or "0,4,7" or "3" -> a set of chart indices. */
function parseOnly(spec: string): Set<number> {
  const out = new Set<number>();
  for (const part of spec.split(",")) {
    const m = /^(\d+)-(\d+)$/.exec(part.trim());
    if (m) {
      for (let n = Number(m[1]); n <= Number(m[2]); n++) out.add(n);
    } else if (/^\d+$/.test(part.trim())) {
      out.add(Number(part.trim()));
    } else {
      throw new Error(`bad --only spec: ${spec}`);
    }
  }
  return out;
}

async function needTools(): Promise<void> {
  const r = await doctor();
  console.log(r.lines.join("\n"));
  if (!r.ok) {
    console.error("\nMissing tools — install the packages above and re-run.");
    process.exit(1);
  }
}

async function cmdRasterize(m: Manifest, a: Args): Promise<void> {
  const seen = new Set<string>();
  for (const chart of m.charts) {
    const pdf = chartSourcePdf(m, chart);
    const cacheKey = `${pdf}#${chart.pageEnd}`;
    if (seen.has(cacheKey)) continue;
    seen.add(cacheKey);
    const r = await rasterizePdf(pdf, m.dpi, { force: a.force, lastPage: chart.pageEnd });
    console.log(`${path.basename(pdf)}: ${r.pageCount} page(s) -> ${r.rasterDir}`);
  }
}

async function cmdOcr(m: Manifest, a: Args): Promise<void> {
  const preCfg = preprocessFromArgs(a) ?? m.preprocess ?? DEFAULT_PREPROCESS;
  for (const chart of m.charts) {
    const pdf = chartSourcePdf(m, chart);
    const raster = await rasterizePdf(pdf, m.dpi, { force: a.force, lastPage: chart.pageEnd });
    for (let p = chart.pageStart; p <= chart.pageEnd; p++) {
      const raw = path.join(rasterDir(raster.pdfSha), cachePageName(p, "png"));
      const pre = await preprocessPage(raw, preCfg, { force: a.force });
      const r = await ocrPage(pre.pngPath, { force: a.force, psm: a.psm });
      const ops = pre.appliedOps.length ? ` [${pre.appliedOps.join(", ")}]` : "";
      console.log(
        `chart ${chart.index} p${p}: ${r.words.length} words, conf ${r.meanConf.toFixed(0)}${ops}`,
      );
    }
  }
}

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

function describeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "(unparseable DATABASE_URL)";
  }
}

async function cmdImport(m: Manifest, a: Args): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set. Use `npm run digitize:dev import` (loads .env.local).");
    process.exit(1);
  }
  const host = describeHost(url);
  console.log(`Target database: ${host}`);
  if (/ep-calm-brook/.test(host) && !a.yes) {
    console.error("Refusing: that looks like the production Neon branch. Re-run with --yes if you mean it.");
    process.exit(1);
  }

  const sql = getSql();
  const applied = (await sql.query(
    `select 1 from schema_migrations where filename = '0002_digitization.sql'`,
  )) as unknown[];
  if (applied.length === 0) {
    console.error("Migration 0002_digitization.sql is not applied. Run `npm run db:migrate` first.");
    process.exit(1);
  }

  const ndjsonPath = path.join(batchOutDir(m.batchId), "records.ndjson");
  if (!(await exists(ndjsonPath))) {
    console.error(`No records at ${ndjsonPath}. Run \`digitize extract\` first.`);
    process.exit(1);
  }
  const records: ChartRecord[] = (await readFile(ndjsonPath, "utf8"))
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as ChartRecord);

  const tally: Record<string, number> = { inserted: 0, replaced: 0, skipped: 0, failed: 0 };
  const describeMatch = (sm: SongMatch) =>
    sm.decision === "matched" ? `matched "${sm.matchedTitle}" (${sm.score})` : sm.decision;

  for (const r of records) {
    const chart: ImportableChart = {
      idempotencyKey: r.idempotencyKey,
      arrangementName: r.arrangementName,
      matchTitle: r.extractedTitle ?? r.manifestTitle ?? r.arrangementName,
      chordproBody: r.chordproBody,
      scanPdfPath: r.scan.pdfPath,
      scanPageCount: r.scan.pageCount,
      pages: r.scan.pages,
      extractionWarnings: r.warnings,
    };
    try {
      const res = await importChartRecord(sql, chart);
      tally[res.outcome]++;
      console.log(`  #${r.index} ${res.outcome.padEnd(9)} ${describeMatch(res.songMatch)}`);
    } catch (err) {
      tally.failed++;
      const why = err instanceof ArrangementValidationError ? err.message : (err as Error).message;
      console.log(`  #${r.index} failed    ${why}`);
    }
  }

  console.log(
    `\n${tally.inserted} inserted, ${tally.replaced} replaced, ${tally.skipped} skipped, ${tally.failed} failed.`,
  );
  if (tally.failed > 0) process.exitCode = 1;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.cmd === "doctor") {
    await needTools();
    return;
  }
  if (!["rasterize", "ocr", "report", "extract", "import"].includes(args.cmd)) {
    console.error(
      "usage: digitize <doctor|rasterize|ocr|report|extract|import> [--manifest path] [--only 0-19] [--force] [--apply] [--yes] [--preprocess auto|on|off] [--no-deskew] [--conf-floor N]",
    );
    process.exit(1);
  }

  const manifest = await loadManifest(args.manifest);

  if (args.cmd === "rasterize" || args.cmd === "ocr" || args.cmd === "extract" || args.cmd === "report") {
    await needTools();
  }

  switch (args.cmd) {
    case "rasterize":
      await cmdRasterize(manifest, args);
      break;
    case "ocr":
      await cmdOcr(manifest, args);
      break;
    case "report":
    case "extract": {
      const summary = await runExtract(manifest, {
        force: args.force,
        dryRun: args.cmd === "report" || args.dryRun,
        only: args.only,
        psm: args.psm,
        preprocess: preprocessFromArgs(args),
        confFloor: args.confFloor,
      });
      console.log(
        `${summary.records.length} chart(s) -> ${summary.outDir}` +
          (summary.failed.length ? `, ${summary.failed.length} failed` : ""),
      );
      console.log(`report: ${path.join(summary.outDir, "report.md")}`);
      if (args.cmd === "extract" && args.apply) await cmdImport(manifest, args);
      break;
    }
    case "import":
      await cmdImport(manifest, args);
      break;
  }
}

main().catch((err) => {
  if (err instanceof ManifestError) console.error(`manifest: ${err.message}`);
  else console.error(err instanceof Error ? err.stack ?? err.message : String(err));
  process.exit(1);
});
