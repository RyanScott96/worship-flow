import { parse } from "../chordpro";
import { resolveKey } from "../transpose";

export class ArrangementValidationError extends Error {}

/** Bad input building a service or a setlist item (surfaced as a form error). */
export class ServiceValidationError extends Error {}

/**
 * A delete was refused because another row still points at this record —
 * e.g. a `service_item` referencing an arrangement (`on delete restrict`).
 * Callers turn this into a "remove it from those services first" message
 * instead of an unhandled 500.
 */
export class RecordInUseError extends Error {}

function hasSqlState(err: unknown, code: string): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === code
  );
}

/** True for a Postgres foreign-key-violation (SQLSTATE 23503). */
export function isForeignKeyViolation(err: unknown): boolean {
  return hasSqlState(err, "23503");
}

/** True for a Postgres unique-violation (SQLSTATE 23505). */
export function isUniqueViolation(err: unknown): boolean {
  return hasSqlState(err, "23505");
}

/**
 * The {key: ...} directive in the ChordPro text is the single source of
 * truth for an arrangement's key — `arrangement.source_key` is derived from
 * it on every save, rather than kept as an independently-editable field, so
 * the two can never drift out of sync.
 */
export function deriveSourceKey(chordproBody: string): string {
  const doc = parse(chordproBody);
  const key = doc.directives.key;
  if (!key) {
    throw new ArrangementValidationError(
      "Add a {key: ...} line to this chart before saving.",
    );
  }
  try {
    resolveKey(key);
  } catch {
    throw new ArrangementValidationError(
      `"${key}" isn't a key this app recognizes. Use a standard major/minor key, e.g. G, Bb, F#m.`,
    );
  }
  return key;
}
