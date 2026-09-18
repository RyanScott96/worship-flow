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
| `docs/DIGITIZATION.md` | Working on the scan → OCR → import pipeline, or how retained scans reach the app. |
| `db/migrations/` | Any data model work. |

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

Phase 1 in progress: `docs/ROADMAP.md`. ChordPro parser, transposition module, song/arrangement
CRUD, the ChordPro editor with live preview and render modes, and `.pro` export are built.
No accounts/auth yet (`edited_by`/`verified_by` stay null) — not in Phase 1 scope.

## Decided along the way

- **Scanner:** the church's Kyocera TASKalfa MZ250lci (existing hardware, ask before using).
  Confirmed 2026-09-18 to scan-to-folder at 300 dpi grayscale, fast enough that there's no
  case for higher DPI — committed to for the full ~300-chart batch. See `docs/ROADMAP.md`.
- **Scans live in the church's Google Drive**, in the shared "Band Music & Lyrics" folder —
  not a rack or object storage. Editor access confirmed 2026-09-18. Flat layout (one PDF per
  song), manual upload, share links captured at import time. See D-10, D-21. Upload and
  link-capture are still unbuilt — `docs/DIGITIZATION.md` § Storage.
- **On-screen chart viewer is funded and expected** — the pastor offered to buy the worship
  team iPads (2026-09-01, reaffirmed 2026-09-18), so the tablet viewer is planned work, not
  gated on a request. No purchase yet. See D-17 and ROADMAP Phase 3.
- **Hands-free page turn: DIY ESP32 foot switches**, not a bought pedal (AirTurn/PageFlip/
  Coda) — BLE HID keyboard emulation, same mechanism the roadmap already scoped for a
  commercial unit, so this is still near-zero app work. Decided 2026-09-18, pilot (does it
  hold up on a real tablet on a stand) still pending on tablet purchase. See ROADMAP Phase 3.
- **OCR approach:** Tesseract + geometry, not VLM. See D-16.
- **Digitization script:** `scripts/digitize/` — TypeScript/Node, run via `npm run digitize`
  (`npm run digitize:dev` loads `.env.local`). Reuses `lib/chordpro` / `lib/transpose`.
  Runbook: `scripts/digitize/README.md`. Its schema support is migration `0002`.
