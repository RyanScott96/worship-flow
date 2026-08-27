# Worship Team Support App

Internal tool for a single small church. ~12 users (7 worship + AV). Not a product, not
multi-tenant, will never have paying customers. Optimize for "a volunteer can still run this
in three years," not for scale.

## What it does

1. **Song library** — chord charts stored as ChordPro, searchable.
2. **Transposition** — render any chart in any key, with capo support.
3. **Setlists** — ordered service plans, per-song key chosen per service.
4. **Digitization** — one-time batch import of ~300 paper charts via scan + OCR.

Later, maybe: theme matching (suggest songs from sermon text), scheduling.

## Read these before working

Do not load all of these at once. Load what the task needs.

| File | Load when |
|---|---|
| `docs/DOMAIN.md` | Touching chords, keys, transposition, ChordPro. **Required** for that work. |
| `docs/DECISIONS.md` | Proposing architecture changes, or if a design choice seems wrong. |
| `docs/ROADMAP.md` | Deciding what to build next, or scoping. |
| `db/schema.sql` | Any data model work. |

## Non-negotiables

These were decided deliberately. `docs/DECISIONS.md` has the reasoning. Do not change them
without asking the user first.

- **ChordPro is the canonical storage format.** Not PDF, not a custom format, not MusicXML.
- **Key lives on `service_item`, not `song`.** The same song is played in different keys
  depending on who leads.
- **Original scans are retained forever** alongside parsed data, and are viewable in-app.
  Extraction errors are corrected against the scan, not prevented.
- **No batch review queue.** Correction happens inline during normal use.
- **Digitization is a standalone local script**, not part of the web app.

## Conventions

- TypeScript, strict mode.
- Postgres. Migrations are plain `.sql` files, numbered, forward-only.
- Transposition logic is a **pure module with no I/O and no framework imports**. It has the
  densest test suite in the repo. Treat it as a library.
- No secrets in the repo. `.env.local` only.

## Current state

Phase 1 in progress: `docs/ROADMAP.md`. ChordPro parser and transposition module underway.

## Still undecided

Ask the user rather than picking:

- **Where scans are served from** (church rack vs cloud object storage).

## Decided along the way

- **Scanner:** the church's Kyocera TASKalfa MZ250lci (existing hardware, ask before using).
  Confirm it can scan-to-folder at 300 dpi grayscale during the Phase 1.5 pilot before
  committing to it — see `docs/ROADMAP.md`.
- **OCR approach:** Tesseract + geometry, not VLM. See D-16.
