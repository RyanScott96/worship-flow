# Digitization: paper chart → app

> **Status 2026-09-28 (D-22):** the church's ~300-chart batch is cancelled. The script stays
> as a personal import path for your own paper charts. The church Google Drive storage
> (D-10, D-21) is retired, and scan storage/viewing is undecided (§ Storage).

How a paper chart becomes an `unverified` arrangement in
the app, and where the chain is still open. This is the **map**. The step-by-step
operator runbook is `scripts/digitize/README.md`; the *why* behind each choice is
in `docs/DECISIONS.md` (D-05, D-08, D-09, D-10, D-16, D-21).

Everything up to and including `import` runs **locally**, on the laptop wired to
the scanner (D-08) — never in the app, never in CI.

## Lifecycle

```
paper binder
  │  scan-to-folder, 300 dpi grayscale (D-05)
  ▼
scans/binder-NN.pdf
  │  digitize split  —  thumbnail grid, click each song's first page (D-09)
  ▼
scans/manifest.json           per-song page ranges into the binder PDF
  │  digitize rasterize  —  pdftoppm
  ▼
.digitize-cache/  per-page grayscale PNG  +  WebP derivative     [addressed on PDF bytes]
  │  digitize ocr  —  preprocess, then tesseract
  ▼
.digitize-cache/  word boxes (TSV)                               [addressed on image bytes]
  │  digitize extract  —  geometric chord/lyric splice (D-16)
  ▼
out/<batchId>/
  ├── records.ndjson              one ChartRecord per song: ChordPro + warnings + scan paths
  ├── report.md                   pilot go/no-go, human-readable
  ├── failed.ndjson               charts that didn't extract, with why
  ├── import.sql                  naive INSERTs — eyeballing only, not the import path
  └── scans/<slug>-<index>/
        ├── original.pdf          the sliced per-song PDF — canonical archive (D-05)
        └── page-01.webp …        local-only OCR/geometry derivative
  │  digitize import  —  upsert into Neon (idempotent)
  ▼
Neon Postgres
  ├── arrangement        chordpro_body, review_status='unverified',
  │                      extraction_method='ocr_geometric',
  │                      extraction_batch_key='<batchId>#<index>',
  │                      scan_pdf_path, scan_page_count        ← a local RELATIVE path
  └── arrangement_page   one row per page: page_number, image_path ← written, unused

  ░░ UNDECIDED ░░  where scans live and whether the app shows them (D-05, D-22).
                    Scans stay in out/<batchId>/scans/ on the machine you ran it on.
```

## Stage reference

| Stage | Command | Reads | Writes | Cache |
|---|---|---|---|---|
| Scan | *(operator)* | paper | `scans/binder-NN.pdf` | — |
| Split | `digitize split` | the binder PDF | `scans/manifest.json` | reuses raster cache |
| Rasterize | `digitize rasterize` † | PDF + manifest | PNG + WebP in `.digitize-cache/` | keyed on PDF bytes |
| OCR | `digitize ocr` † | the PNGs | preprocessed PNG + TSV in `.digitize-cache/` | keyed on image bytes + `--psm` |
| Extract | `digitize extract` | TSV + manifest | `out/<batchId>/` — records, report, per-song scan slices | reuses raster + OCR cache |
| Report | `digitize report` | same as extract | `out/<batchId>/` records + report **only** — no scan slices, no DB | — |
| Import | `digitize import` | `out/<batchId>/records.ndjson` | `arrangement` + `arrangement_page` rows in Neon | idempotent on `extraction_batch_key` |

† `rasterize` and `ocr` auto-run inside `extract`; invoke them directly only to pre-warm the cache while the next binder scans.

## Idempotency (import)

`import` upserts on `arrangement.extraction_batch_key = '<batchId>#<index>'`:

| existing row | action |
|---|---|
| none | insert — song fuzzy-matched to an existing one, else created |
| pristine — `unverified` + `ocr_geometric` + zero revisions | replace body / warnings / scan / pages |
| verified, flagged, or edited in-app | **skip** — never clobbered |

So re-running the extractor after a heuristic tweak, and re-importing after
fixing a page range, are both safe. Schema: `db/migrations/0001_init.sql`
(`arrangement.scan_pdf_path` / `scan_page_count`, the `arrangement_page` table)
plus `0002_digitization.sql` (`extraction_batch_key` upsert index, method CHECK).
Logic: `lib/db/digitization.ts`.

## Storage — undecided since the pivot

`import` records a local relative path (`scans/<slug>-<index>/original.pdf`,
`scripts/digitize/paths.ts` `relScanPdf`) in `arrangement.scan_pdf_path`. Nothing
turns that into something the deployed app can resolve, and there is no in-app scan
viewer. Keep `out/<batchId>/scans/`: those are the originals you correct against (D-05).

The church-era design (scans in the church's Google Drive, share links captured at
import, D-10/D-21) is retired with D-22. A replacement has to fit "never host music for
others": the scan is the chart owner's file. It's listed under ROADMAP → Later and not
designed yet. The per-page WebP derivatives stay a local, disposable OCR/geometry
artifact either way.

## See also

- `scripts/digitize/README.md` — prerequisites, every flag, troubleshooting, fixture regeneration.
- `docs/DECISIONS.md` — D-05 (keep the scan, correct against it), D-08 (local script), D-09 (`split`), D-16 (Tesseract + geometry), D-22 (pivot; retires D-10/D-21 Drive storage).
- `docs/DOMAIN.md` §7 — the chord/lyric x-center splice the extractor performs.
