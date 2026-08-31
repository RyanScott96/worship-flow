// The service schedule is wall-clock time in the church's own timezone. A bare
// `datetime-local` value has no offset, and `new Date(str)` / `Date` getters use
// whatever timezone the running process happens to be in — so a service created
// from a laptop and rendered on Vercel could disagree by the UTC offset. Pin the
// conversion to one zone instead.
//
// One church, one timezone, forever. If it's ever wrong, this is the only line
// to change.
export const CHURCH_TZ = "America/New_York";

/** Minutes that `tz` is offset from UTC at `instant` (DST-aware). */
function tzOffsetMinutes(instant: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const f = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const asUTC = Date.UTC(
    Number(f.year),
    Number(f.month) - 1,
    Number(f.day),
    Number(f.hour === "24" ? "0" : f.hour),
    Number(f.minute),
    Number(f.second),
  );
  return (asUTC - instant.getTime()) / 60000;
}

/**
 * "2026-09-06T10:00" (church wall clock) -> the ISO instant. Returns null if the
 * string isn't a valid `datetime-local` value.
 */
export function wallClockToInstant(local: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(local.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  const guess = Date.UTC(+y, +mo - 1, +d, +h, +mi, s ? +s : 0);
  // Measure the offset at the guessed instant, then correct once. A second pass
  // would resolve the rare DST-boundary ambiguity, but services aren't scheduled
  // at 2:30am on the fall-back Sunday.
  const offset = tzOffsetMinutes(new Date(guess), CHURCH_TZ);
  const instant = new Date(guess - offset * 60000);
  return Number.isNaN(instant.getTime()) ? null : instant.toISOString();
}

/** ISO instant -> "2026-09-06T10:00" in the church zone, for a datetime-local field. */
export function instantToWallClock(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CHURCH_TZ,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(iso));
  const f = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${f.year}-${f.month}-${f.day}T${f.hour === "24" ? "00" : f.hour}:${f.minute}`;
}

/** "Sunday, September 13, 2026 at 9:30 AM" in the church zone. */
export function formatServiceWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: CHURCH_TZ,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "Sun, Sep 13, 2026" in the church zone. */
export function formatServiceDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone: CHURCH_TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
