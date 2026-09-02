# Digitization: paper chart → app

How one of the ~300 filing-cabinet charts becomes an `unverified` arrangement in
the app, and where the chain is still open. This is the **map**. The step-by-step
operator runbook is `scripts/digitize/README.md`; the *why* behind each choice is
in `docs/DECISIONS.md` (D-05, D-08, D-09, D-10, D-16).

Everything up to and including `import` runs **locally**, on the laptop wired to
the scanner (D-08) — never in the app, never in CI.

## Lifecycle

```
paper binder
  │  scan-to-folder, 300 dpi grayscale — Kyocera TASKalfa (D-05)
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
        └── page-01.webp …        per-page viewer derivatives
  │  digitize import  —  upsert into Neon (idempotent)
  ▼
Neon Postgres
  ├── arrangement        chordpro_body, review_status='unverified',
  │                      extraction_method='ocr_geometric',
  │                      extraction_batch_key='<batchId>#<index>',
  │                      scan_pdf_path, scan_page_count           ← RELATIVE paths
  └── arrangement_page   one row per page: page_number, image_path ← RELATIVE path

  ░░ NOT WIRED ░░  publish  out/<batchId>/scans/  →  church Google Drive (D-10)
  ▼
Google Drive          ░ upload mechanism undesigned ░

  ░░ NOT WIRED ░░  app resolves the stored relative paths → real URLs
  ▼
in-app scan viewer    ░ not built — D-05 "one tap from the chart view" ░
```

## Stage reference

| Stage | Command | Reads | Writes | Cache |
|---|---|---|---|---|
| Scan | *(operator)* | paper | `scans/binder-NN.pdf` | — |
| Split | `digitize split` | the binder PDF | `scans/manifest.json` | reuses raster cache |
| Rasterize | `digitize rasterize` † | PDF + manifest | PNG + WebP in `.digitize-cache/` | keyed on PDF bytes |
| OCR | `digitize ocr` † | the PNGs | preprocessed PNG + TSV in `.digitize-cache/` | keyed on image bytes |
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

## Storage — destination decided, mechanism undesigned

`import` writes **relative** paths only — `scans/<slug>-<index>/original.pdf` and
`scans/<slug>-<index>/page-01.webp` — into `arrangement.scan_pdf_path` and
`arrangement_page.image_path`. Nothing in the app resolves them yet.

Per **D-10**, retained scans live in the church's **Google Drive** — their whole
workflow already runs on it. That destination is settled but **provisional**
until the pilot follow-up with the contact the pastor named (2026-09-01) confirms
app access and a folder layout. Two pieces are still unbuilt:

1. **Upload** — how `out/<batchId>/scans/` gets *into* Drive. Options on the
   table, none chosen: a `digitize publish` subcommand over `rclone` or the Drive
   API; a Drive-for-Desktop synced folder the operator drops the batch into; a
   plain one-time manual upload (it is a one-time batch).
2. **Serving** — how the deployed Next app on Vercel turns a stored relative path
   into bytes an `<img>` can load. Options, none chosen: a Next route that reads
   Drive with a service account and proxies the bytes; per-file "anyone with the
   link" share URLs written *as* the path at import time; a mirror to Vercel Blob.
   This is coupled to the **in-app scan viewer** (D-05), which also does not exist.

Both are gated on the pilot follow-up. Until then the pipeline runs end to end
**locally**: `extract` produces the scan slices on disk and `import` records their
paths — only the last hop to a live app is missing.

## See also

- `scripts/digitize/README.md` — prerequisites, every flag, troubleshooting, fixture regeneration.
- `docs/DECISIONS.md` — D-05 (scans retained + shown in-app), D-08 (local script), D-09 (`split`), D-10 (Drive), D-16 (Tesseract + geometry).
- `docs/DOMAIN.md` §7 — the chord/lyric x-center splice the extractor performs.
