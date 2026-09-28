# Guitar Practice App

A personal, mobile-first practice and learning tool for guitar chord charts — in the
spirit of Ultimate Guitar Tabs, but built around **your own charts**. It never hosts
music for others: no public catalog, no sharing. Open source; run your own copy.

It started as a worship-team tool for one church and pivoted on 2026-09-28 (see
`docs/DECISIONS.md` D-22). See [`CLAUDE.md`](CLAUDE.md) for scope and the
non-negotiables, and [`docs/ROADMAP.md`](docs/ROADMAP.md) for what's next.

## What it does

- **Song library** — chord charts stored as ChordPro, searchable, exportable as `.pro`.
- **Transposition** — render any chart in any key, with capo support.
- **Viewer** — chords above lyrics, with key / capo / render-mode controls
  (`.../arrangements/[id]/view`).
- **Digitization** — OCR your own paper charts into ChordPro, as a standalone
  local script (not part of the web app).
- **Planned** — practice mode (metronome, autoscroll, looping), chord diagrams and
  tabs, progress tracking, theory aids.

Services/setlists are still in the code from the church era, but retired.

## Stack

Next.js (App Router) · TypeScript strict · Postgres (Neon) · Tailwind · shadcn/ui
(planned, ROADMAP Phase 0) · Vitest.
Migrations are plain numbered `.sql` files, forward-only — no ORM.

## Getting started

```bash
npm install
```

Create `.env.local` with a Postgres connection string (no secrets in the repo):

```bash
DATABASE_URL=postgres://...
```

Apply migrations, then run the dev server:

```bash
npm run db:migrate   # applies db/migrations/*.sql to DATABASE_URL from .env.local
npm run dev          # http://localhost:3000
```

## Everyday commands

| Command | Does |
|---|---|
| `npm run dev` | Dev server |
| `npm test` | Vitest (transposition has the densest suite in the repo) |
| `npm run lint` | ESLint |
| `npm run build` | Production build |
| `npm run db:migrate` | Apply pending migrations to the local dev branch |

## Digitization

The OCR import of paper chord charts is a standalone local tool:
`scripts/digitize/`, run via `npm run digitize`. Runbook:
[`scripts/digitize/README.md`](scripts/digitize/README.md).

## Docs

Load what a task needs, not all at once.

| File | For |
|---|---|
| [`docs/DOMAIN.md`](docs/DOMAIN.md) | Chords, keys, transposition, ChordPro |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Why the architecture is the way it is |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | What's built and what's next |
| [`docs/DIGITIZATION.md`](docs/DIGITIZATION.md) | The scan → OCR → import pipeline |
| [`docs/DEPLOY.md`](docs/DEPLOY.md) | Deploying (Vercel + Neon branches) |
