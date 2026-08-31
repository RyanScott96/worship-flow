import type { NeonQueryFunction } from "@neondatabase/serverless";
import { deriveSourceKey } from "./validation";

// DB integration for the one-time OCR import (scripts/digitize). Kept out of
// songs.ts / arrangements.ts: those hard-code extraction_method='manual' and
// never touch the scan / warnings columns, which is right for the app's own
// create paths. This module owns the 'ocr_geometric' path and its idempotency.

type Sql = NeonQueryFunction<false, false>;

export type SongMatch =
  | { decision: "matched"; songId: string; matchedTitle: string; score: number }
  | { decision: "created" }
  | {
      decision: "ambiguous";
      candidates: { songId: string; title: string; score: number }[];
    };

export type ImportOutcome = "inserted" | "replaced" | "skipped" | "failed";

/** Minimal shape importChartRecord needs — a subset of the digitize ChartRecord. */
export interface ImportableChart {
  idempotencyKey: string;
  arrangementName: string;
  /** Title to match against existing songs (falls back to arrangementName). */
  matchTitle?: string;
  chordproBody: string;
  scanPdfPath: string;
  scanPageCount: number;
  pages: { pageNumber: number; imagePath: string }[];
  /** Serialized straight into the jsonb column. */
  extractionWarnings: unknown;
}

/** lowercase, drop a leading article, strip punctuation, collapse whitespace. */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/^\s*(the|a|an)\s+/, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Match a chart title against existing songs by trigram similarity.
 * strong  (>= .55, no close runner-up) -> matched
 * >=2 candidates >= .45                 -> ambiguous  (importer creates a new song)
 * otherwise                             -> created
 */
export async function resolveSongIdentity(
  sql: Sql,
  title: string,
): Promise<SongMatch> {
  const norm = normalizeTitle(title);
  if (norm === "") return { decision: "created" };

  const rows = (await sql.query(
    `select id, title, similarity(lower(title), $1) as score
       from song
      where similarity(lower(title), $1) > 0.30
      order by score desc
      limit 5`,
    [norm],
  )) as { id: string; title: string; score: number }[];

  if (rows.length === 0) return { decision: "created" };

  const top = rows[0];
  const runnerUp = rows[1]?.score ?? 0;
  if (top.score >= 0.55 && runnerUp < 0.45) {
    return {
      decision: "matched",
      songId: top.id,
      matchedTitle: top.title,
      score: Number(top.score.toFixed(3)),
    };
  }

  const close = rows.filter((r) => r.score >= 0.45);
  if (close.length >= 2) {
    return {
      decision: "ambiguous",
      candidates: close.map((r) => ({
        songId: r.id,
        title: r.title,
        score: Number(r.score.toFixed(3)),
      })),
    };
  }

  return { decision: "created" };
}

interface ExistingRow {
  id: string;
  song_id: string;
  song_title: string;
  review_status: string;
  extraction_method: string | null;
  revs: number;
}

async function findExisting(sql: Sql, key: string): Promise<ExistingRow | null> {
  const rows = (await sql.query(
    `select a.id, a.song_id, s.title as song_title, a.review_status, a.extraction_method,
            (select count(*)::int from arrangement_revision r where r.arrangement_id = a.id) as revs
       from arrangement a
       join song s on s.id = a.song_id
      where a.extraction_batch_key = $1`,
    [key],
  )) as ExistingRow[];
  return rows[0] ?? null;
}

/** Replace `.songMatch` on a warnings object with the decision actually taken. */
function stampSongMatch(warnings: unknown, songMatch: SongMatch): string {
  if (warnings && typeof warnings === "object") {
    return JSON.stringify({ ...(warnings as Record<string, unknown>), songMatch });
  }
  return JSON.stringify(warnings);
}

function pageInserts(sql: Sql, key: string, pages: ImportableChart["pages"]) {
  return pages.map((p) =>
    sql.query(
      `insert into arrangement_page (arrangement_id, page_number, image_path)
       select id, $2, $3 from arrangement where extraction_batch_key = $1`,
      [key, p.pageNumber, p.imagePath],
    ),
  );
}

export interface ImportResult {
  arrangementId: string;
  outcome: ImportOutcome;
  songMatch: SongMatch;
}

/**
 * Idempotent on `chart.idempotencyKey` (-> arrangement.extraction_batch_key):
 *  - no row            -> insert (song matched or created)
 *  - row, pristine     -> replace body/warnings/scan + pages
 *  - row, not pristine -> skip (verified / flagged / hand-edited)
 * Pristine = unverified AND ocr_geometric AND zero revisions.
 */
export async function importChartRecord(
  sql: Sql,
  chart: ImportableChart,
): Promise<ImportResult> {
  const key = chart.idempotencyKey;
  // Throws ArrangementValidationError if the {key:} is missing/unresolvable —
  // the caller writes this chart to failed.ndjson and moves on.
  const sourceKey = deriveSourceKey(chart.chordproBody);

  const existing = await findExisting(sql, key);

  if (existing) {
    const pristine =
      existing.review_status === "unverified" &&
      existing.extraction_method === "ocr_geometric" &&
      existing.revs === 0;

    // On replace we never re-parent; record the arrangement's actual song.
    const songMatch: SongMatch = {
      decision: "matched",
      songId: existing.song_id,
      matchedTitle: existing.song_title,
      score: 1,
    };

    if (!pristine) {
      return { arrangementId: existing.id, outcome: "skipped", songMatch };
    }

    await sql.transaction([
      sql.query(
        `update arrangement set
           name = $2, chordpro_body = $3, source_key = $4,
           extraction_warnings = $5::jsonb, scan_pdf_path = $6, scan_page_count = $7,
           updated_at = now()
         where id = $1`,
        [
          existing.id,
          chart.arrangementName,
          chart.chordproBody,
          sourceKey,
          stampSongMatch(chart.extractionWarnings, songMatch),
          chart.scanPdfPath,
          chart.scanPageCount,
        ],
      ),
      sql.query(`delete from arrangement_page where arrangement_id = $1`, [existing.id]),
      ...pageInserts(sql, key, chart.pages),
    ]);

    return { arrangementId: existing.id, outcome: "replaced", songMatch };
  }

  const identity = await resolveSongIdentity(sql, chart.matchTitle ?? chart.arrangementName);

  // $1..$7 are identical for both variants; $8 is either the matched song id or
  // the title for a freshly-created song.
  const params = [
    key,
    chart.arrangementName,
    chart.chordproBody,
    sourceKey,
    chart.scanPdfPath,
    chart.scanPageCount,
    stampSongMatch(chart.extractionWarnings, identity),
    identity.decision === "matched" ? identity.songId : chart.arrangementName,
  ];
  const cols = `(song_id, name, chordpro_body, source_key, review_status, extraction_method,
     extraction_batch_key, scan_pdf_path, scan_page_count, extraction_warnings)`;
  const vals = `$2, $3, $4, 'unverified', 'ocr_geometric', $1, $5, $6, $7::jsonb`;

  const insertArrangement =
    identity.decision === "matched"
      ? sql.query(
          `insert into arrangement ${cols} values ($8, ${vals}) returning id`,
          params,
        )
      : sql.query(
          `with s as (insert into song (title) values ($8) returning id)
           insert into arrangement ${cols}
           select s.id, ${vals} from s
           returning id`,
          params,
        );

  const result = (await sql.transaction([
    insertArrangement,
    ...pageInserts(sql, key, chart.pages),
  ])) as { id: string }[][];

  const arrangementId = result[0][0].id;
  return { arrangementId, outcome: "inserted", songMatch: identity };
}
