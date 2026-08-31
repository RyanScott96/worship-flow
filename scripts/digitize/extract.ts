// I/O orchestration for `digitize extract`: rasterize + OCR each chart's pages,
// run the pure assembler, write the batch artifacts (records.ndjson, import.sql,
// report.md, failed.ndjson) and the per-song scan slices.

import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { deriveSourceKey } from "../../lib/db/validation";
import { assembleChart } from "./assemble";
import {
  batchOutDir,
  cachePageName,
  chartScanDir,
  rasterDir,
  relScanPage,
  relScanPdf,
  slugify,
  songPageName,
  webpCacheDir,
} from "./paths";
import { chartSourcePdf } from "./manifest";
import { ocrPage } from "./ocr";
import { DEFAULT_PREPROCESS, preprocessPage } from "./preprocess";
import { rasterizePdf } from "./rasterize";
import { renderReport } from "./report";
import { run } from "./sh";
import type {
  ChartRecord,
  ExtractionWarnings,
  Manifest,
  ManifestChart,
  PreprocessConfig,
} from "./types";

export interface ExtractOptions {
  force?: boolean;
  dryRun?: boolean;
  only?: Set<number>;
  psm?: number;
  preprocess?: PreprocessConfig;
  confFloor?: number;
}

export interface ExtractSummary {
  batchId: string;
  outDir: string;
  records: ChartRecord[];
  failed: { index: number; reason: string }[];
}

function warningsFor(
  manifest: Manifest,
  chart: ManifestChart,
  a: ReturnType<typeof assembleChart>,
  preOps: string[],
): ExtractionWarnings {
  const notes = [...a.notes];
  if (preOps.length) notes.push(`Preprocessing: ${preOps.join("; ")}`);
  return {
    schema: 1,
    batchId: manifest.batchId,
    index: chart.index,
    extractedAt: new Date().toISOString(),
    meanOcrConf: a.metrics.meanOcrConf,
    songMatch: { decision: "deferred" },
    keyDetection: a.keyDetection,
    checks: a.checks,
    structure: a.structure,
    notes,
  };
}

async function slicePdf(
  sourcePdf: string,
  pageStart: number,
  pageEnd: number,
  destPdf: string,
): Promise<void> {
  const tmp = path.join(path.dirname(destPdf), ".slice");
  await rm(tmp, { recursive: true, force: true });
  await mkdir(tmp, { recursive: true });
  await run("pdfseparate", [
    "-f",
    String(pageStart),
    "-l",
    String(pageEnd),
    sourcePdf,
    path.join(tmp, "p-%d.pdf"),
  ]);
  const parts: string[] = [];
  for (let p = pageStart; p <= pageEnd; p++) parts.push(path.join(tmp, `p-${p}.pdf`));
  await run("pdfunite", [...parts, destPdf]);
  await rm(tmp, { recursive: true, force: true });
}

export async function runExtract(
  manifest: Manifest,
  opts: ExtractOptions,
): Promise<ExtractSummary> {
  const outDir = batchOutDir(manifest.batchId);
  await mkdir(outDir, { recursive: true });

  const charts = manifest.charts
    .filter((c) => !opts.only || opts.only.has(c.index))
    .sort((a, b) => a.index - b.index);

  const records: ChartRecord[] = [];
  const failed: { index: number; reason: string }[] = [];

  for (const chart of charts) {
    try {
      const sourcePdf = chartSourcePdf(manifest, chart);
      const raster = await rasterizePdf(sourcePdf, manifest.dpi, {
        force: opts.force,
        lastPage: chart.pageEnd,
      });

      const preCfg =
        opts.preprocess ?? manifest.preprocess ?? DEFAULT_PREPROCESS;

      const pagesWords = [];
      const pageMeanConfs: number[] = [];
      const preOps: string[] = [];
      for (let p = chart.pageStart; p <= chart.pageEnd; p++) {
        const raw = path.join(rasterDir(raster.pdfSha), cachePageName(p, "png"));
        const pre = await preprocessPage(raw, preCfg, { force: opts.force });
        if (pre.appliedOps.length) {
          preOps.push(`p${p}: ${pre.appliedOps.join(", ")}`);
        }
        const r = await ocrPage(pre.pngPath, { force: opts.force, psm: opts.psm });
        pagesWords.push(r.words);
        pageMeanConfs.push(r.meanConf);
      }

      const assembled = assembleChart({
        chart,
        pagesWords,
        pageMeanConfs,
        confFloor: opts.confFloor ?? manifest.confFloor,
      });

      // Guard: the DB layer rejects an unresolvable {key:}. keydetect's fallback
      // makes this unreachable, but fail this one chart loudly if it ever isn't.
      deriveSourceKey(assembled.chordproBody);

      const slug = slugify(assembled.arrangementName);
      const pageCount = chart.pageEnd - chart.pageStart + 1;
      const pages = [];
      for (let i = 0; i < pageCount; i++) {
        pages.push({
          pageNumber: i + 1,
          imagePath: relScanPage(slug, chart.index, i + 1),
        });
      }

      if (!opts.dryRun) {
        const dir = chartScanDir(manifest.batchId, slug, chart.index);
        await mkdir(dir, { recursive: true });
        await slicePdf(sourcePdf, chart.pageStart, chart.pageEnd, path.join(dir, "original.pdf"));
        for (let i = 0; i < pageCount; i++) {
          const src = path.join(
            webpCacheDir(raster.pdfSha),
            cachePageName(chart.pageStart + i, "webp"),
          );
          await copyFile(src, path.join(dir, songPageName(i + 1)));
        }
      }

      const record: ChartRecord = {
        batchId: manifest.batchId,
        index: chart.index,
        idempotencyKey: `${manifest.batchId}#${chart.index}`,
        manifestTitle: chart.title ?? null,
        extractedTitle: assembled.extractedTitle,
        arrangementName: assembled.arrangementName,
        sourceKey: assembled.sourceKey,
        chordproBody: assembled.chordproBody,
        scan: { pdfPath: relScanPdf(slug, chart.index), pageCount, pages },
        extractionMethod: "ocr_geometric",
        songMatch: { decision: "deferred" },
        metrics: assembled.metrics,
        warnings: warningsFor(manifest, chart, assembled, preOps),
      };
      records.push(record);
    } catch (err) {
      failed.push({ index: chart.index, reason: (err as Error).message });
    }
  }

  const ndjson = records.map((r) => JSON.stringify(r)).join("\n");
  await writeFile(path.join(outDir, "records.ndjson"), ndjson + (ndjson ? "\n" : ""), "utf8");
  await writeFile(
    path.join(outDir, "failed.ndjson"),
    failed.map((f) => JSON.stringify(f)).join("\n"),
    "utf8",
  );
  await writeFile(path.join(outDir, "import.sql"), renderImportSql(records), "utf8");
  await writeFile(path.join(outDir, "report.md"), renderReport(manifest, records, failed), "utf8");

  return { batchId: manifest.batchId, outDir, records, failed };
}

/** Naive INSERTs for a FRESH database / eyeballing only — no idempotency, no
 *  fuzzy song match. `digitize import` is the real path. */
export function renderImportSql(records: ChartRecord[]): string {
  const esc = (s: string) => `'${s.replace(/'/g, "''")}'`;
  const lines: string[] = [
    "-- Generated by `digitize extract`. Naive INSERTs — NO idempotency, NO song",
    "-- de-duplication. Prefer `digitize import`. Safe only against an empty DB.",
    "begin;",
  ];
  for (const r of records) {
    lines.push(
      `with s as (insert into song (title) values (${esc(r.arrangementName)}) returning id)`,
      `insert into arrangement`,
      `  (song_id, name, chordpro_body, source_key, review_status, extraction_method,`,
      `   extraction_batch_key, scan_pdf_path, scan_page_count, extraction_warnings)`,
      `select s.id, ${esc(r.arrangementName)}, ${esc(r.chordproBody)}, ${esc(r.sourceKey)},`,
      `  'unverified', 'ocr_geometric', ${esc(r.idempotencyKey)}, ${esc(r.scan.pdfPath)},`,
      `  ${r.scan.pageCount}, ${esc(JSON.stringify(r.warnings))}::jsonb`,
      `from s;`,
      "",
    );
  }
  lines.push("commit;");
  return lines.join("\n");
}
