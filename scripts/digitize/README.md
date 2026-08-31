# Digitization pipeline (`scripts/digitize`)

One-time OCR import of the church's ~300 paper chord charts into the app as
`unverified` arrangements, with every scan retained (D-05). Runs **locally**, on
the laptop wired to the scanner (D-08) — not in the app, not in CI.

Data flow:

```
binder-NN.pdf + manifest.json
  -> rasterize   (pdftoppm)      PDF -> per-page PNG + WebP        [cached]
  -> ocr         (tesseract)     PNG -> word boxes (TSV)           [cached]
  -> extract                     boxes -> ChordPro + warnings + per-song scan slices
  -> report                      pilot go/no-go, human-readable
  -> import                      rows in Neon (idempotent)
  -> rsync out/<batch>/scans/    to wherever scans are served from
```

Chord placement is geometric, not a VLM (D-16, DOMAIN.md §7): each chord token's
x-center is matched to the character beneath it in the lyric line.

## Prerequisites

- Node ≥ 24, then `npm ci`.
- System binaries: `tesseract` **with the `eng` traineddata**, `poppler`
  (`pdftoppm`, `pdfseparate`, `pdfunite`), and `imagemagick` (`magick`).
  - Arch: `pacman -S tesseract tesseract-data-eng poppler imagemagick`
  - Debian/Ubuntu: `apt install tesseract-ocr tesseract-ocr-eng poppler-utils imagemagick`
  - Verify: `npm run digitize doctor`
  - If `eng` lives outside the default tessdata dir, export
    `TESSDATA_PREFIX=/path/to/tessdata` before running.
- `DATABASE_URL` in `.env.local` pointing at the **development** Neon branch —
  never production for the pilot. `npm run digitize:dev …` loads `.env.local`
  automatically; plain `npm run digitize …` uses the ambient environment.
- Apply the digitization migration once: `npm run db:migrate`
  (adds `arrangement.extraction_batch_key` + the method CHECK — `0002`).

## Scanning

Scan each binder to **one PDF** at **300 dpi grayscale** — not bitonal (kills
faint pencil), not colour (3× size, no OCR gain) — into `scans/`. On the church
Kyocera TASKalfa MZ250lci this is scan-to-folder; confirm the DPI/greyscale
setting on the pilot batch before committing to it for all 300.

## `manifest.json`

The page splitter (D-09) is a separate tool. Until it exists, hand-author the
per-song page ranges:

```jsonc
{
  "batchId": "binder-01-2026-08",   // stable; the idempotency namespace. /^[a-z0-9][a-z0-9._-]*$/i
  "sourcePdf": "binder-01.pdf",     // relative to this file
  "dpi": 300,
  "charts": [
    {
      "index": 0,                   // stable ordinal; part of the idempotency key
      "title": "Amazing Grace",     // optional — OCR extracts its own title too
      "pageStart": 1,               // 1-based, inclusive
      "pageEnd": 2,                 // 1-based, inclusive
      "expectedPageCount": 2,       // sheets you counted feeding the scanner
      "key": "G"                    // optional; used only if key detection fails
    }
  ]
}
```

`expectedPageCount` is separate from `pageEnd - pageStart + 1` on purpose: if the
scanner double-feeds and silently drops a sheet, the two disagree and the
extractor flags it (validator 4). Count sheets as you feed them.

## The pilot (ROADMAP Phase 1.5, step 1)

```
npm run digitize report -- --only 0-19
```

Open `out/<batchId>/report.md`. For each chart it shows the extracted ChordPro
next to its warnings, chord/lyric line counts, mean OCR confidence, and how the
key was detected. Compare a few against the paper — especially the worst
photocopies. This is the go/no-go before scanning all 300. `report` writes no
`records.ndjson` and never touches the database.

**The OCR-confidence gate.** The line right under the count says
`N of M chart(s) below the OCR confidence floor (75)` and names the offending
`#index`es; each flagged chart also carries a `> [!WARNING] RE-SCAN CANDIDATE`
callout. The floor (75) is a starting value in `scripts/digitize/quality.ts` —
override per run with `--conf-floor N` or per batch with `"confFloor"` in
`manifest.json`. When it fires: pull that original, re-scan it at 300 dpi
grayscale, wipe the scanner glass; on a stubborn single page try
`npm run digitize report -- --psm 6`. This line is the concrete answer to
ROADMAP Phase 1.5 step 1 ("check DPI is adequate on the worst photocopies").

## Preprocessing

Between rasterize and OCR each page runs through `preprocess.ts` —
deskew, background/illumination flatten, gentle contrast, despeckle. **Grayscale
in, grayscale out; never bitonal** (D-05 — pencil annotations must survive). The
viewer WebP is still built from the raw, un-preprocessed raster.

`--preprocess auto` (the default) probes each page and skips every step it
doesn't need, so a born-digital PDF passes straight through untouched. `on`
forces the chain; `off` disables it; `--no-deskew` turns off just the rotate.
A page's applied ops show up in `report.md` as a `Preprocessing: ...` note.

Preprocessed pages are their own content-addressed cache stage
(`.digitize-cache/preprocessed/`); changing the config re-OCRs only the pages it
affects. `rm -rf .digitize-cache` clears everything; `--force` bypasses it.

> Validated against a synthetic scan-degradation corpus
> (`__fixtures__/scan-*`), **not yet against real paper**. Re-tune every
> threshold in `scripts/digitize/quality.ts` on the first real binder.

## Full run

```
npm run digitize rasterize                 # optional; extract auto-runs it
npm run digitize ocr                        # optional; extract auto-runs it
npm run digitize extract                    # -> out/<batchId>/{records.ndjson,import.sql,report.md,failed.ndjson}
#   inspect report.md / records.ndjson
npm run digitize:dev import                 # apply records.ndjson to the DB
#   or, in one step:
npm run digitize:dev extract -- --apply
```

Re-run freely. The cache is content-addressed on file bytes, so after you tune a
heuristic and re-run `extract`, every raster and OCR result is reused — only the
fast logic re-runs. A re-scanned PDF has new bytes, so it re-rasterizes and
re-OCRs on its own. `rm -rf .digitize-cache` to reclaim space; `--force` ignores
the cache for one run.

**Idempotency.** `import` keys on `${batchId}#${index}`
(`arrangement.extraction_batch_key`):

| existing row | action |
|---|---|
| none | insert (song fuzzy-matched to an existing one, else created) |
| pristine — `unverified` + `ocr_geometric` + **zero revisions** | replace body / warnings / scan / pages |
| anything else (verified, flagged, or edited in-app) | **skip** — never clobbered |

So it's safe to re-import after fixing the manifest, and safe to keep importing
new binders into the same run over days.

`import.sql` is naive `INSERT`s with **no** idempotency and no song matching —
it's for eyeballing or a throwaway empty DB only. `digitize import` is the real
path.

## Publishing the scans

`import` stores **relative** paths (`scans/<slug>/original.pdf`,
`scans/<slug>/page-01.webp`). Where scans are actually served from — the church
rack or object storage — is still undecided (see `CLAUDE.md`). Once decided,
`rsync out/<batchId>/scans/` there and point the app's base path at it.

## Fixing mistakes

- **Wrong split** (bad page range): edit `manifest.json`, re-run
  `extract` + `import`. Pristine rows are replaced.
- **Bad extraction found after go-live**: fix it in the app at Wednesday practice
  against the scan (D-06). A later re-import will **not** overwrite it — the edit
  left a revision, so the row is no longer pristine.
- **A chart in `failed.ndjson`**: usually a source PDF path problem or a page
  range past the end of the PDF. Fix and re-run; the rest of the batch already
  imported.

## Troubleshooting

- `npm run digitize doctor` — checks every binary and the `eng` traineddata.
- `--force` — ignore the cache for this run. `rm -rf .digitize-cache` — full reset.
- `out/<batchId>/failed.ndjson` — one line per chart that didn't extract, with why.
- `import` refuses if `DATABASE_URL` looks like the production Neon branch
  (`ep-calm-brook`) unless you pass `--yes`, and refuses if `0002` isn't applied.

## Still deferred — what unblocks each

- **Page splitting (D-09)** — hand-author `manifest.json` for the pilot.
  Unblocked when the thumbnail-click tool that emits it is built; needed before
  the full 300-chart run, not the pilot.
- **Scan serving location** — `import` stores relative paths (see *Publishing the
  scans*). Unblocked when church-rack-vs-object-storage is decided; then it's a
  base-path config + `rsync`, no code change to the pipeline.
- **Handwritten-annotation noise, residual-skew handling, OSD auto-rotate** —
  need real annotated photocopies to calibrate. Until then a garbled scrawl
  shows up as a visible `[garbage]` next to the retained scan (fixed inline,
  D-06) and the confidence gate flags the page.

## Deliberately not here

- **Handwriting / pencil annotations** (D-05) — preserved in the image only,
  never parsed.
- **A review queue / review screen** (D-06) — correction is inline in the app.
- **Two-pass consensus extraction** (D-06) — single pass plus the validators.
- **VLM / hosted-OCR fallback** (D-16); real binarization / adaptive threshold
  (D-05); a Tesseract char whitelist (kills `7` / `9` / `sus4` / "Capo 3").

## Regenerating the test fixtures

Two committed fixture families under `scripts/digitize/__fixtures__/`:

- `<name>/` (clean-typeset, faded-photocopy, …) — synthetic Tesseract-shaped
  TSV from positioned-word specs: `node __fixtures__/generate.mjs`.
- `scan-<profile>/` — a degraded PNG twin of a clean seed
  (`__fixtures__/_seeds/`) plus the post-`preprocess` OCR:
  `node __fixtures__/scan-degrade.mjs`, then recapture `words.tsv` per that
  script's header comment.

After regenerating either, eyeball the `words.tsv`, refresh the matching
`expected.pro` / `expected.warnings.json` / `pageconf.json`, and run `npm test`.
The real shell-out check is env-gated:
`DIGITIZE_INTEGRATION=1 npx vitest run scripts/digitize/preprocess.integration.test.ts`.
