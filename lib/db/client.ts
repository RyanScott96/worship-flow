import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

// Lazy init: calling neon() at module load time throws if DATABASE_URL isn't
// set yet, which would crash `next build` before env vars are provisioned.
let sql: NeonQueryFunction<false, false> | null = null;

export function getSql(): NeonQueryFunction<false, false> {
  if (!sql) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is not set.");
    }
    sql = neon(databaseUrl);
  }
  return sql;
}
