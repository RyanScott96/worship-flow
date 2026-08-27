// Minimal forward-only migration runner. Applies db/migrations/*.sql in filename
// order, tracking what's already run in a `schema_migrations` table. No ORM, no
// migration framework — per CLAUDE.md, migrations are just plain numbered .sql files.
//
// Usage: node db/migrate.mjs   (reads DATABASE_URL from the environment)

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";

const migrationsDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "migrations",
);

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set.");
  }
  const sql = neon(databaseUrl);

  await sql`
    create table if not exists schema_migrations (
      filename     text primary key,
      applied_at   timestamptz not null default now()
    )
  `;

  const applied = new Set(
    (await sql`select filename from schema_migrations`).map((row) => row.filename),
  );

  const files = (await readdir(migrationsDir))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  let ranAny = false;
  for (const file of files) {
    if (applied.has(file)) continue;
    ranAny = true;
    console.log(`Applying ${file}...`);
    const contents = await readFile(path.join(migrationsDir, file), "utf8");
    // The HTTP driver doesn't support multi-statement strings, so run each
    // statement (naively split on `;` at end of line) individually.
    const statements = contents
      .split(/;\s*\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const statement of statements) {
      await sql.query(statement);
    }
    await sql`insert into schema_migrations (filename) values (${file})`;
    console.log(`Applied ${file}.`);
  }

  if (!ranAny) {
    console.log("No pending migrations.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
