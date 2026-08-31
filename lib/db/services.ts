import { resolveKey } from "../transpose";
import { getSql } from "./client";
import {
  isForeignKeyViolation,
  RecordInUseError,
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

export async function createService(
  input: NewServiceInput,
): Promise<{ serviceId: string }> {
  const startsAt = new Date(input.startsAt);
  if (Number.isNaN(startsAt.getTime())) {
    throw new ServiceValidationError("Enter a valid date and time.");
  }
  const sql = getSql();
  const rows = (await sql`
    insert into service (name, starts_at, notes)
    values (${input.name}, ${startsAt.toISOString()}, ${input.notes ?? null})
    returning id
  `) as { id: string }[];
  return { serviceId: rows[0].id };
}

export async function updateService(
  id: string,
  input: NewServiceInput,
): Promise<void> {
  const startsAt = new Date(input.startsAt);
  if (Number.isNaN(startsAt.getTime())) {
    throw new ServiceValidationError("Enter a valid date and time.");
  }
  const sql = getSql();
  await sql`
    update service set
      name = ${input.name},
      starts_at = ${startsAt.toISOString()},
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

async function nextPosition(sql: ReturnType<typeof getSql>, serviceId: string) {
  const rows = (await sql`
    select coalesce(max(position), -1) + 1 as pos
    from service_item where service_id = ${serviceId}
  `) as { pos: number }[];
  return rows[0].pos;
}

export async function addSongItem(
  serviceId: string,
  input: AddSongItemInput,
): Promise<void> {
  const keyOverride = normalizeKeyOverride(input.keyOverride);
  const capo = normalizeCapo(input.capo);
  const sql = getSql();
  const position = await nextPosition(sql, serviceId);
  try {
    await sql`
      insert into service_item
        (service_id, position, arrangement_id, item_type, key_override, capo, notes)
      values
        (${serviceId}, ${position}, ${input.arrangementId}, 'song',
         ${keyOverride}, ${capo}, ${input.notes?.trim() || null})
    `;
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
  const sql = getSql();
  const position = await nextPosition(sql, serviceId);
  await sql`
    insert into service_item (service_id, position, item_type, title, notes)
    values (${serviceId}, ${position}, ${input.itemType}, ${title}, ${input.notes?.trim() || null})
  `;
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
  const sql = getSql();
  try {
    await sql`delete from service_item where id = ${itemId}`;
  } catch (err) {
    if (isForeignKeyViolation(err)) {
      throw new RecordInUseError("This item can't be removed right now.");
    }
    throw err;
  }
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
