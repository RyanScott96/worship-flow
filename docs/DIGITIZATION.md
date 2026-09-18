# Digitization: paper chart → app

How one of the ~300 filing-cabinet charts becomes an `unverified` arrangement in
the app, and where the chain is still open. This is the **map**. The step-by-step
operator runbook is `scripts/digitize/README.md`; the *why* behind each choice is
in `docs/DECISIONS.md` (D-05, D-08, D-09, D-10, D-16, D-21).

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
        └── page-01.webp …        local-only OCR/geometry derivative, not published (D-21)
  │  digitize import  —  upsert into Neon (idempotent)
  ▼
Neon Postgres
  ├── arrangement        chordpro_body, review_status='unverified',
  │                      extraction_method='ocr_geometric',
  │                      extraction_batch_key='<batchId>#<index>',
  │                      scan_pdf_path, scan_page_count           ← scan_pdf_path null
  │                                                                 until published
  └── arrangement_page   one row per page: page_number, image_path ← written today,
                                                    unused by the redesigned viewer (D-21)

  │  operator drags original.pdf into Drive, renamed <slug>-<index>.pdf (manual, D-21)
  ▼
Google Drive          "Band Music & Lyrics" / Scans / <slug>-<index>.pdf  (flat, D-10)

  ░░ NOT WIRED ░░  digitize link-scans (name TBD) — Drive API lookup by filename,
                    writes each file's share link to arrangement.scan_pdf_path (D-21)
  ▼
in-app scan viewer    ░ not built — embeds the PDF directly via scan_pdf_path,
                        native PDF pagination, no per-page derivatives (D-05, D-21) ░
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

## Storage — design settled 2026-09-18, still unbuilt

Access to the church's Drive is confirmed (editor access on the shared "Band Music &
Lyrics" folder) and the two mechanisms D-10 originally left open are now decided — see
**D-21**. Three pieces remain to actually build:

1. **Upload** — manual. The operator drags each `out/<batchId>/scans/<slug>-<index>/
   original.pdf` into a `Scans` subfolder in Drive, renamed `<slug>-<index>.pdf` (flat
   layout, D-10). No new code.
2. **Link capture** — a small script step (name TBD, e.g. `digitize link-scans`) that
   looks up each uploaded file's share URL via the Drive API by filename and writes it to
   `arrangement.scan_pdf_path`, replacing today's `import`-time null. Read-only against
   Drive; the deployed app never calls the Drive API itself.
3. **In-app scan viewer** (D-05) — embeds the PDF at `scan_pdf_path` directly, using its
   native pagination. No per-page derivatives needed: `scans/<slug>-<index>/page-01.webp`
   stays a local, disposable OCR/geometry artifact (word-box extraction reads image bytes,
   not PDF bytes) and is never published or served. Whether `arrangement_page.image_path`
   and `scan_page_count` get dropped from the schema or just go unused is implementation
   work, not decided here.

Until all three land, the pipeline runs end to end **locally**: `extract` produces the
scan slices on disk, `import` writes everything except `scan_pdf_path`, and the last hop
to a live, viewable scan is missing.

## See also

- `scripts/digitize/README.md` — prerequisites, every flag, troubleshooting, fixture regeneration.
- `docs/DECISIONS.md` — D-05 (scans retained + shown in-app), D-08 (local script), D-09 (`split`), D-10 (Drive), D-16 (Tesseract + geometry), D-21 (upload + serving mechanism).
- `docs/DOMAIN.md` §7 — the chord/lyric x-center splice the extractor performs.
