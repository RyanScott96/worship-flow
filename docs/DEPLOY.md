# Deploying

Hosting is Vercel + Neon Postgres (D-11, D-10). One project, two long-lived
environments.

| Git branch    | Vercel target | Neon branch                       | Who sees it            |
|---------------|---------------|-----------------------------------|------------------------|
| `development` | Preview       | `development` (`ep-falling-boat`) | team, via preview URLs |
| `main`        | Production    | `main` (`ep-calm-brook`)          | production URL         |

Neon project id: `late-sun-48292829`.

Local `npm run dev` and `npm run db:migrate` use `.env.local`, which points at the
`development` Neon branch. Nothing local touches production.

## The promotion path

1. **Do the work on `development`.** Every push builds a Vercel preview via
   `vercel-build` = `node db/migrate.mjs && next build`. On a deploy of the
   `development` branch itself, pending migrations are applied to the
   `development` Neon branch first, and a failed migration fails the build.
   Deploys of other feature branches **skip** migration — so an unreviewed
   migration can't land on the shared database from its first push. If such a
   branch needs new schema to preview correctly, run `npm run db:migrate` against
   the dev branch yourself.

2. **Promote by fast-forwarding `main` to `development`:**

   ```bash
   git checkout main
   git merge --ff-only development
   git push origin main
   git checkout development
   ```

   Vercel auto-deploys `main` to production. `vercel-build` applies pending
   migrations to the `main` Neon branch first, then builds. If a migration
   fails, the deploy fails and production keeps serving the previous version.

3. **Verify** the production URL, then carry on `development`.

Keep `main` a strict ancestor of `development` (fast-forward only). If they ever
diverge, reconcile on `development` first so the promotion stays a fast-forward.

## Rollback

`vercel rollback` (or "Promote to Production" on an older deployment in the
dashboard) reverts the **code**. Migrations are forward-only and are **not**
reversed. So every migration must be safe against the previously deployed code:

- Adding tables/columns/indexes: safe, ship anytime.
- Dropping or renaming a column the current code still reads: **two deploys** —
  first ship code that no longer uses it, then a later migration drops it.

## Migrations

- Plain SQL, in `db/migrations/`, named `NNNN_short_description.sql`, next number,
  forward-only. Never edit a file that has already been applied anywhere.
- Each file is applied in **one transaction** (its statements plus the
  `schema_migrations` row commit together). Don't put statements Postgres refuses
  inside a transaction in a migration — e.g. `CREATE INDEX CONCURRENTLY`. This
  library is small enough that a plain `CREATE INDEX` is always fine.
- The statement splitter is naive — it splits on `;` at end of line. No
  `$$`-quoted function or `DO` bodies in a migration.
- `schema_migrations` (filename PK) tracks what has run. Re-running is a no-op.
- Overlapping runs (two Vercel builds at once) serialize on a Postgres advisory
  lock; a file another run applied first is detected and skipped, not failed.

### Running migrations by hand

Normally you never do this — `vercel-build` runs them on production and
`development` deploys. Use it only to fix forward after an auto-run failed, or to
migrate a feature branch's schema out of band.

```bash
npm run db:migrate        # local dev branch (.env.local)
npm run db:migrate:prod   # Neon `main` branch — needs an authenticated Neon CLI
```

`db:migrate:prod` runs `node db/migrate.mjs --neon-branch main`, which resolves
the connection string through the Neon CLI (the production `DATABASE_URL` in
Vercel is a Secret and can't be pulled with `vercel env pull`). It fails with a
clear message if the Neon CLI is missing or unauthenticated.

## Environment variables

The app reads exactly one: `DATABASE_URL`. It is set in Vercel for all three
environments (Development/Preview → `development` branch, Production → `main`
branch). The other `POSTGRES_*` / `PG*` / `NEON_*` vars come from the Neon
integration and are unused by application code.
