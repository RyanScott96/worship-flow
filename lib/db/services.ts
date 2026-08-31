import { wallClockToInstant } from "../church-time";
import { resolveKey } from "../transpose";
import { getSql } from "./client";
import {
  isForeignKeyViolation,
  isUniqueViolation,
  ServiceValidationError,
} from "./validation";
import type {
  ServiceItemDetail,
  ServiceItemType,
  ServiceRow,
  ServiceWithItems,
} from "./types";

const NON_SONG_TYPES: ServiceItemType[] = [
  "prayer",
  "sermon",
  "announcement",
  "other",
];

export async function listServices(): Promise<ServiceRow[]> {
  const sql = getSql();
  return (await sql`
    select * from service order by starts_at desc
  `) as ServiceRow[];
}

export async function getServiceWithItems(
  id: string,
): Promise<ServiceWithItems | null> {
  const sql = getSql();
  const services = (await sql`
    select * from service where id = ${id}
  `) as ServiceRow[];
  const service = services[0];
  if (!service) return null;

  const items = (await sql`
    select
      si.*,
      a.song_id,
      a.name          as arrangement_name,
      a.source_key,
      a.chordpro_body,
      a.review_status,
      s.title         as song_title
    from service_item si
    left join arrangement a on a.id = si.arrangement_id
    left join song s        on s.id = a.song_id
    where si.service_id = ${id}
    order by si.position
  `) as ServiceItemDetail[];

  return { service, items };
}

export interface NewServiceInput {
  name: string;
  /** ISO string or anything `new Date()` accepts. */
  startsAt: string;
  notes?: string;
}

/** `datetime-local` string (church wall clock) -> ISO instant, or a clean error. */
function parseStartsAt(raw: string): string {
  const iso = wallClockToInstant(raw);
  if (!iso) throw new ServiceValidationError("Enter a valid date and time.");
  return iso;
}

export async function createService(
  input: NewServiceInput,
): Promise<{ serviceId: string }> {
  const startsAt = parseStartsAt(input.startsAt);
  const sql = getSql();
  const rows = (await sql`
    insert into service (name, starts_at, notes)
    values (${input.name}, ${startsAt}, ${input.notes ?? null})
    returning id
  `) as { id: string }[];
  return { serviceId: rows[0].id };
}

export async function updateService(
  id: string,
  input: NewServiceInput,
): Promise<void> {
  const startsAt = parseStartsAt(input.startsAt);
  const sql = getSql();
  await sql`
    update service set
      name = ${input.name},
      starts_at = ${startsAt},
      notes = ${input.notes ?? null}
    where id = ${id}
  `;
}

export async function deleteService(id: string): Promise<void> {
  const sql = getSql();
  // service_item rows cascade; a song in the set never blocks deleting a service.
  await sql`delete from service where id = ${id}`;
}

// ---------------------------------------------------------------------------
// items
// ---------------------------------------------------------------------------

/** Validate + normalize a per-service key override. Empty -> null. */
function normalizeKeyOverride(raw: string | undefined): string | null {
  const key = raw?.trim();
  if (!key) return null;
  try {
    resolveKey(key);
  } catch {
    throw new ServiceValidationError(
      `"${key}" isn't a key this app recognizes. Use a standard major/minor key, e.g. G, Bb, F#m.`,
    );
  }
  return key;
}

function normalizeCapo(raw: string | undefined): number | null {
  const t = raw?.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isInteger(n) || n < 0 || n > 11) {
    throw new ServiceValidationError("Capo must be a whole number from 0 to 11.");
  }
  return n;
}

export interface AddSongItemInput {
  arrangementId: string;
  keyOverride?: string;
  capo?: string;
  notes?: string;
}

export interface AddNonSongItemInput {
  itemType: Exclude<ServiceItemType, "song">;
  title: string;
  notes?: string;
}

/**
 * Run `insert` (which must compute `position` from `max(position)+1` inline), and
 * on a unique-violation — two people adding to the same service at once racing
 * for the same position — retry once. A second collision surfaces as a friendly
 * error rather than a 500.
 */
async function appendItem(insert: () => Promise<unknown>): Promise<void> {
  try {
    await insert();
    return;
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
  }
  try {
    await insert(); // one retry — max(position)+1 is re-evaluated
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new ServiceValidationError(
        "Couldn't add the item — someone else may be editing this service. Try again.",
      );
    }
    throw err;
  }
}

export async function addSongItem(
  serviceId: string,
  input: AddSongItemInput,
): Promise<void> {
  const keyOverride = normalizeKeyOverride(input.keyOverride);
  const capo = normalizeCapo(input.capo);
  const notes = input.notes?.trim() || null;
  const sql = getSql();
  try {
    await appendItem(() => sql`
      insert into service_item
        (service_id, position, arrangement_id, item_type, key_override, capo, notes)
      select ${serviceId},
             coalesce(max(position), -1) + 1,
             ${input.arrangementId}, 'song', ${keyOverride}, ${capo}, ${notes}
      from service_item where service_id = ${serviceId}
    `);
  } catch (err) {
    if (isForeignKeyViolation(err)) {
      throw new ServiceValidationError("That arrangement no longer exists.");
    }
    throw err;
  }
}

export async function addNonSongItem(
  serviceId: string,
  input: AddNonSongItemInput,
): Promise<void> {
  if (!NON_SONG_TYPES.includes(input.itemType)) {
    throw new ServiceValidationError("Unknown item type.");
  }
  const title = input.title.trim();
  if (!title) throw new ServiceValidationError("Give the item a title.");
  const notes = input.notes?.trim() || null;
  const sql = getSql();
  await appendItem(() => sql`
    insert into service_item (service_id, position, item_type, title, notes)
    select ${serviceId}, coalesce(max(position), -1) + 1, ${input.itemType}, ${title}, ${notes}
    from service_item where service_id = ${serviceId}
  `);
}

export interface UpdateServiceItemInput {
  keyOverride?: string;
  capo?: string;
  title?: string;
  notes?: string;
}

export async function updateServiceItem(
  itemId: string,
  input: UpdateServiceItemInput,
): Promise<void> {
  const keyOverride = normalizeKeyOverride(input.keyOverride);
  const capo = normalizeCapo(input.capo);
  const sql = getSql();
  await sql`
    update service_item set
      key_override = ${keyOverride},
      capo = ${capo},
      title = coalesce(${input.title?.trim() || null}, title),
      notes = ${input.notes?.trim() || null}
    where id = ${itemId}
  `;
}

export async function removeServiceItem(itemId: string): Promise<void> {
  // Nothing references service_item.id, so a delete can't be blocked.
  const sql = getSql();
  await sql`delete from service_item where id = ${itemId}`;
}

/**
 * Move one item up or down by swapping positions with its neighbour. The
 * `unique (service_id, position) deferrable initially deferred` constraint lets
 * the two updates transiently collide and settle at commit.
 */
export async function moveServiceItem(
  serviceId: string,
  itemId: string,
  direction: "up" | "down",
): Promise<void> {
  const sql = getSql();
  const rows = (await sql`
    select id, position from service_item
    where service_id = ${serviceId}
    order by position
  `) as { id: string; position: number }[];

  const i = rows.findIndex((r) => r.id === itemId);
  if (i === -1) return;
  const j = direction === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= rows.length) return;

  await sql.transaction([
    sql`update service_item set position = ${rows[j].position} where id = ${rows[i].id}`,
    sql`update service_item set position = ${rows[i].position} where id = ${rows[j].id}`,
  ]);
}
