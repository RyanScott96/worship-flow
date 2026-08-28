// Minimal forward-only migration runner. Applies db/migrations/*.sql in filename
// order, tracking what's already run in a `schema_migrations` table. No ORM, no
// migration framework — per CLAUDE.md, migrations are just plain numbered .sql files.
//
// Each migration file is applied in a single transaction (statements + the
// schema_migrations insert commit together, or not at all). Consequences: a
// migration must not contain statements Postgres refuses to run inside a
// transaction (e.g. `CREATE INDEX CONCURRENTLY`), and the statement splitter is
// deliberately naive (splits on `;` at end of line) so no `$$`-quoted function
// or DO bodies. For a ~300-song church library neither has ever been needed.
//
// Usage:
//   node db/migrate.mjs                     # DATABASE_URL from the environment
//   node db/migrate.mjs --neon-branch main  # resolve DATABASE_URL via the Neon CLI
//   npm run db:migrate                      # local dev branch (--env-file=.env.local)
//   npm run db:migrate:prod                 # Neon `main` branch (via the Neon CLI)
//
// On Vercel this runs as part of `vercel-build` before `next build`. It migrates
// only for production deploys and for deploys of the `development` branch — the
// two branches that have their own long-lived Neon branch. Other preview deploys
// (feature branches) skip migration, so an unreviewed migration can't land on the
// shared `development` database from its first push. A failed migration fails the
// build, so a broken deploy never reaches users.

import { execFileSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";

const migrationsDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "migrations",
);

// The Neon project that hosts every branch of this app's database. Not a secret —
// the Neon CLI still needs its own auth to do anything with it.
const NEON_PROJECT_ID = process.env.NEON_PROJECT_ID ?? "late-sun-48292829";

// Arbitrary constant so overlapping runners (e.g. two Vercel builds at once)
// serialize on one Postgres advisory lock instead of racing on the same file.
const MIGRATION_LOCK_KEY = 918273645;

// An explicit DATABASE_URL always wins. Otherwise `--neon-branch <name>` asks the
// Neon CLI for a connection string. Anything else is a clear error.
function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const flagIndex = process.argv.indexOf("--neon-branch");
  if (flagIndex !== -1) {
    const branch = process.argv[flagIndex + 1];
    if (!branch) {
      throw new Error("--neon-branch needs a branch name, e.g. --neon-branch main");
    }
    let out;
    try {
      out = execFileSync(
        "neon",
        ["connection-string", branch, "--project-id", NEON_PROJECT_ID],
        { encoding: "utf8" },
      ).trim();
    } catch {
      throw new Error(
        `Couldn't get a connection string for Neon branch "${branch}". ` +
          "Install the Neon CLI and authenticate it (`neon auth`).",
      );
    }
    if (!out) {
      throw new Error(
        `The Neon CLI returned nothing for branch "${branch}" — is it authenticated?`,
      );
    }
    return out;
  }

  throw new Error(
    "DATABASE_URL is not set. Use `npm run db:migrate` for the local dev branch " +
      "or `npm run db:migrate:prod` for production.",
  );
}

// On a Vercel build, decide whether this deploy should migrate. Returns a reason
// string when migration should be skipped, or null to proceed.
function vercelSkipReason() {
  const env = process.env.VERCEL_ENV;
  if (!env) return null; // not a Vercel build — someone ran this deliberately
  if (env === "production") return null;
  if (env === "preview" && process.env.VERCEL_GIT_COMMIT_REF === "development") {
    return null;
  }
  return `VERCEL_ENV=${env} branch=${process.env.VERCEL_GIT_COMMIT_REF ?? "?"}`;
}

// Log where we're pointed (host + database only, never credentials) so deploy
// and CI logs record which branch was migrated.
function describeTarget(databaseUrl) {
  try {
    const u = new URL(databaseUrl);
    return `${u.host}${u.pathname}`;
  } catch {
    return "(unparseable DATABASE_URL)";
  }
}

// Split a .sql file into individual statements. The Neon HTTP driver rejects
// multi-statement strings, so `transaction()` needs them one per array entry.
// Naive split on `;` at end of line — fine for the plain DDL this project uses.
function splitStatements(sqlText) {
  return sqlText
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s.replace(/--.*$/gm, "").trim().length > 0);
}

async function main() {
  const skip = vercelSkipReason();
  if (skip) {
    console.log(`Skipping migrations on this deploy (${skip}).`);
    return;
  }

  const databaseUrl = resolveDatabaseUrl();
  const sql = neon(databaseUrl);
  console.log(`Migrating ${describeTarget(databaseUrl)}`);

  await sql`
    create table if not exists schema_migrations (
      filename     text primary key,
      applied_at   timestamptz not null default now()
    )
  `;

  const readApplied = async () =>
    new Set(
      (await sql`select filename from schema_migrations`).map((row) => row.filename),
    );
  const applied = await readApplied();

  const files = (await readdir(migrationsDir))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  let ranAny = false;
  for (const file of files) {
    if (applied.has(file)) continue;
    ranAny = true;
    console.log(`Applying ${file}...`);
    const contents = await readFile(path.join(migrationsDir, file), "utf8");
    const statements = splitStatements(contents);
    try {
      // pg_advisory_xact_lock is held for this transaction, so overlapping
      // runners apply one file at a time. Statements + the tracking row commit
      // together; any failure rolls the whole file back.
      await sql.transaction([
        sql.query("select pg_advisory_xact_lock($1)", [MIGRATION_LOCK_KEY]),
        ...statements.map((statement) => sql.query(statement)),
        sql.query("insert into schema_migrations (filename) values ($1)", [file]),
      ]);
    } catch (err) {
      // A concurrent runner may have applied this file while we waited on the
      // lock. If it's recorded now, that's fine; otherwise the failure is real.
      if ((await readApplied()).has(file)) {
        console.log(`${file} was applied by a concurrent run; continuing.`);
        continue;
      }
      throw err;
    }
    console.log(`Applied ${file}.`);
  }

  console.log(ranAny ? "Done." : "No pending migrations.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
