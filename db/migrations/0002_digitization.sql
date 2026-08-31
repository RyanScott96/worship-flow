-- Phase 1.5 digitization support. See scripts/digitize/ and docs/ROADMAP.md.
--
-- One-time OCR import of ~300 paper charts (D-08, D-16). The extractor is
-- re-run many times as its heuristics get tuned, so it needs a stable per-chart
-- key to upsert on instead of creating duplicates.

-- Idempotency key for an OCR-imported arrangement: `${batchId}#${index}` from
-- the run's manifest.json. Null for every app-created ("manual") arrangement.
alter table arrangement add column if not exists extraction_batch_key text;

-- One arrangement per (batch, chart). Partial so app-created rows (null key)
-- don't collide. This is the digitize importer's upsert target.
create unique index if not exists arrangement_extraction_batch_key
  on arrangement (extraction_batch_key) where extraction_batch_key is not null;

-- types.ts already enumerates these three; the column never had a constraint.
-- Guarded for the existing 'manual'/null rows.
alter table arrangement add constraint arrangement_extraction_method_check
  check (extraction_method is null or extraction_method in ('vlm','ocr_geometric','manual'));
