// D-09 page splitter: an ephemeral localhost thumbnail grid. The operator clicks
// the first page of each song; those marks become manifest.json chart ranges.
// No title detection, no boundary heuristics (D-09) — clicks only. One PDF per
// run; multi-PDF batches stay hand-authored (see README).

import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import { parseManifest } from "./manifest";
import { cachePageName } from "./paths";
import { run } from "./sh";
import type { ManifestChart } from "./types";

export interface SplitResult {
  charts: ManifestChart[];
  /** Pages before the first mark — part of no song, dropped from the manifest. */
  leadingUnassigned: number;
}

/**
 * Marked first-pages -> chart page ranges. Song `i` runs from its mark to the
 * page before the next mark; the last runs to the end of the PDF.
 * `expectedPageCount` is seeded from the range — the operator corrects it in the
 * file if the scanner double-fed (README, validator 4).
 */
export function marksToCharts(markedPages: number[], pageCount: number): SplitResult {
  if (!Number.isInteger(pageCount) || pageCount < 1) {
    throw new Error(`pageCount must be a positive integer, got ${pageCount}`);
  }
  const marks = [...new Set(markedPages)].sort((a, b) => a - b);
  if (marks.length === 0) {
    throw new Error("no pages marked — click the first page of each song first");
  }
  for (const p of marks) {
    if (!Number.isInteger(p) || p < 1 || p > pageCount) {
      throw new Error(`marked page ${p} is outside 1..${pageCount}`);
    }
  }
  const charts: ManifestChart[] = marks.map((pageStart, i) => {
    const pageEnd = (marks[i + 1] ?? pageCount + 1) - 1;
    return { index: i, pageStart, pageEnd, expectedPageCount: pageEnd - pageStart + 1 };
  });
  return { charts, leadingUnassigned: marks[0] - 1 };
}

export interface BuildManifestInput {
  batchId: string;
  sourcePdfBasename: string;
  dpi: number;
  charts: ManifestChart[];
}

/** The plain manifest object, gated through `parseManifest` so the splitter can
 *  never write a file the rest of the pipeline rejects. `baseDir` is where the
 *  file will land; `parseManifest` only records it. */
export function buildManifestObject(
  input: BuildManifestInput,
  baseDir: string,
): { batchId: string; sourcePdf: string; dpi: number; charts: ManifestChart[] } {
  const obj = {
    batchId: input.batchId,
    sourcePdf: input.sourcePdfBasename,
    dpi: input.dpi,
    charts: input.charts.map((c) => ({
      index: c.index,
      pageStart: c.pageStart,
      pageEnd: c.pageEnd,
      expectedPageCount: c.expectedPageCount,
    })),
  };
  parseManifest(obj, baseDir); // throws ManifestError on anything invalid
  return obj;
}

export interface ServeSplitterOptions {
  /** Cache dir holding `page-NNNN.webp` for the source PDF (from rasterizePdf). */
  webpDir: string;
  pageCount: number;
  port: number;
  /** Handles the operator's marks. Throws on bad input; the server stays up so
   *  they can retry. Resolves once the manifest is written. */
  onWrite: (
    markedPages: number[],
  ) => Promise<{ path: string; chartCount: number; leadingUnassigned: number }>;
}

/** Serve the splitter page until the operator writes the manifest, then stop. */
export async function serveSplitter(opts: ServeSplitterOptions): Promise<void> {
  const html = (
    await readFile(path.join(import.meta.dirname, "split.html"), "utf8")
  ).replace(/__PAGE_COUNT__/g, String(opts.pageCount));

  await new Promise<void>((resolve, reject) => {
    const server = createServer((req, res) => {
      handle(req, res).catch((err) => {
        if (!res.headersSent) res.writeHead(500, { "content-type": "text/plain" });
        res.end(err instanceof Error ? err.message : String(err));
      });
    });

    const stop = () => {
      server.close();
      server.closeAllConnections?.();
    };

    async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
      const url = new URL(req.url ?? "/", "http://localhost");

      if (req.method === "GET" && url.pathname === "/") {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(html);
        return;
      }

      const thumb = /^\/thumb\/(\d+)$/.exec(url.pathname);
      if (req.method === "GET" && thumb) {
        const n = Number(thumb[1]);
        if (n < 1 || n > opts.pageCount) {
          res.writeHead(404, { "content-type": "text/plain" });
          res.end("no such page");
          return;
        }
        const file = path.join(opts.webpDir, cachePageName(n, "webp"));
        try {
          await stat(file);
        } catch {
          // A gap inside the page range — raster/webp counts diverged. 404 so the
          // grid cell shows an error, not a silent blank the operator marks past.
          console.error(`split: no thumbnail for page ${n} (${file})`);
          res.writeHead(404, { "content-type": "text/plain" });
          res.end("thumbnail not generated");
          return;
        }
        res.writeHead(200, { "content-type": "image/webp", "cache-control": "no-store" });
        createReadStream(file)
          .on("error", () => res.destroy())
          .pipe(res);
        return;
      }

      if (req.method === "POST" && url.pathname === "/manifest") {
        let marked: number[];
        try {
          const parsed = JSON.parse(await readBody(req)) as { markedPages?: unknown };
          if (
            !Array.isArray(parsed.markedPages) ||
            !parsed.markedPages.every((x) => typeof x === "number")
          ) {
            throw new Error("markedPages must be an array of numbers");
          }
          marked = parsed.markedPages as number[];
        } catch (err) {
          res.writeHead(400, { "content-type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: (err as Error).message }));
          return;
        }
        try {
          const summary = await opts.onWrite(marked);
          res.writeHead(200, { "content-type": "application/json", connection: "close" });
          res.end(JSON.stringify({ ok: true, ...summary }));
          res.on("finish", stop);
        } catch (err) {
          res.writeHead(200, { "content-type": "application/json" });
          res.end(
            JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }),
          );
        }
        return;
      }

      res.writeHead(404, { "content-type": "text/plain" });
      res.end("not found");
    }

    server.on("close", resolve);
    server.on("error", reject);
    server.listen(opts.port, "127.0.0.1", () => {
      // Match the bind literally — `localhost` can resolve to ::1 first on a
      // dual-stack host, where nothing is listening (refused / Happy-Eyeballs stall).
      const uri = `http://127.0.0.1:${opts.port}/`;
      console.log(
        `\n  page splitter running at ${uri}\n` +
          `  ${opts.pageCount} pages — click the first page of each song, then "Write manifest.json".\n` +
          `  Ctrl-C to quit without writing.\n`,
      );
      run(process.platform === "darwin" ? "open" : "xdg-open", [uri]).catch(() => {});
    });
  });
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > 1_000_000) {
        req.destroy();
        reject(new Error("request body too large"));
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}
