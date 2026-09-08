# Worship Team Support App

Internal tool for a single small church (~12 users). Song library, chord-chart
transposition, and service setlists. Not a product — optimized for "a volunteer
can still run this in three years." See [`CLAUDE.md`](CLAUDE.md) for scope and the
non-negotiables.

## What it does

- **Song library** — chord charts stored as ChordPro, searchable.
- **Transposition** — render any chart in any key, with capo support.
- **Setlists** — ordered service plans, per-song key chosen per service.
- **Viewers** — a full-bleed setlist viewer for a whole service and a
  standalone single-arrangement viewer (`.../arrangements/[id]/view`), both with
  key / capo / render-mode controls.
- **Digitization** — one-time batch OCR import of ~300 paper charts, as a
  standalone local script (not part of the web app).

## Stack

Next.js (App Router) · TypeScript strict · Postgres (Neon) · Tailwind · Vitest.
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

## Digitization (Phase 1.5)

The one-time OCR import of paper chord charts is a standalone local tool:
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
