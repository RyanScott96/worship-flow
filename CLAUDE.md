# Guitar Practice App (formerly Worship Team Support App)

**Pivoted 2026-09-28** (D-22). This started as an internal tool for one church, which turned
out to already have CCLI SongSelect. It is now a personal **practice and learning** tool for
guitar charts, loosely in the spirit of Ultimate Guitar Tabs. One user (the author), open
source, not a product, no paying customers. Optimize for "future me can still run this in
three years," not for scale.

## What it does

1. **Song library**: your own chord charts, stored as ChordPro, searchable.
2. **Transposition**: render any chart in any key, with capo support.
3. **Practice**: viewer with metronome, autoscroll, section looping (planned, ROADMAP Phase 1).
4. **Learning**: chord diagrams, tabs, progress tracking, theory aids (planned, Phases 2–4).
5. **Digitization**: a local script to OCR your own paper charts into ChordPro.

**Mobile first** (D-23): design every surface at phone width first; tablet and desktop are
enhancements. PWA, not a native app.

Services/setlists still exist in the code from the church era. Retired and unmaintained;
don't build on them.

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
- **Never host music for others.** Users bring their own charts. No public catalog, no
  submission flow, no shared song pages (D-22).
- **Key is never a property of `song`.** It's a per-player choice (was `service_item`; moves
  to the practice record per D-22).
- **OCR'd charts are corrected against their scan**, not "prevented" by heavier extraction.
- **No batch review queue.** Correction happens inline during normal use.
- **Digitization is a standalone local script**, not part of the web app.

## Conventions

- TypeScript, strict mode.
- Postgres. Migrations are plain `.sql` files, numbered, forward-only.
- Transposition logic is a **pure module with no I/O and no framework imports**. It has the
  densest test suite in the repo. Treat it as a library.
- UI: **shadcn/ui** components; color only through semantic tokens in `app/globals.css`
  (`bg-background`, `text-chord`, …), never raw `black`/`white`/hex (D-24). Migration in
  progress (ROADMAP Phase 0); older components still hardcode `dark:` opacities.
- No secrets in the repo. `.env.local` only.

## Current state

Pivot just landed; see `docs/ROADMAP.md`. Built and carried over: ChordPro parser,
transposition module, song/arrangement CRUD, editor with live preview and render modes, `.pro`
export, chords-above-lyrics viewer with key/capo/mode, Wake Lock. Next: the "Pivot cleanup"
list, then Phase 0 (mobile-first pass + design system), then Phase 1 (practice mode). No
accounts/auth; single user.

## Decided along the way

- **Hands-free page turn: DIY ESP32 foot switches** over BLE HID keyboard emulation (decided
  2026-09-18). Near-zero app work: it sends arrow/page keys. Pilot on the author's phone. See ROADMAP Phase 1.
- **OCR approach:** Tesseract + geometry, not VLM. See D-16.
- **Digitization script:** `scripts/digitize/`, TypeScript/Node, run via `npm run digitize`
  (`npm run digitize:dev` loads `.env.local`). Reuses `lib/chordpro` / `lib/transpose`.
  Runbook: `scripts/digitize/README.md`. Its schema support is migration `0002`. The
  church's ~300-chart batch is cancelled; the script is kept as a personal import path.
- **Retired with the pivot:** the church scanner, church Google Drive scan storage (D-10,
  D-21), church-funded iPads (D-17), theme matching, scheduling. History is in D-22 and git.
