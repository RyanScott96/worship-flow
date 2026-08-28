import { getSql } from "./client";
import {
  deriveSourceKey,
  isForeignKeyViolation,
  RecordInUseError,
} from "./validation";
import type { ArrangementSummary, SongRow } from "./types";

export async function listSongs(query?: string): Promise<SongRow[]> {
  const sql = getSql();
  if (query && query.trim()) {
    return (await sql`
      select * from song
      where title ilike ${"%" + query.trim() + "%"}
      order by title
    `) as SongRow[];
  }
  return (await sql`select * from song order by title`) as SongRow[];
}

export async function getSongWithArrangements(id: string): Promise<{
  song: SongRow;
  arrangements: ArrangementSummary[];
} | null> {
  const sql = getSql();
  const songs = (await sql`select * from song where id = ${id}`) as SongRow[];
  const song = songs[0];
  if (!song) return null;

  const arrangements = (await sql`
    select id, name, source_key, review_status, updated_at
    from arrangement
    where song_id = ${id}
    order by name
  `) as ArrangementSummary[];

  return { song, arrangements };
}

export interface NewSongInput {
  title: string;
  authors?: string;
  ccliNumber?: string;
  copyright?: string;
  defaultKey?: string;
  notes?: string;
  arrangementName?: string;
  chordproBody: string;
}

/**
 * A song is not useful without at least one arrangement. Both inserts run as
 * a single statement (a data-modifying CTE) so it's atomic in one round trip
 * over the HTTP driver, and the arrangement can reference the song's
 * just-generated id without a second request.
 */
export async function createSongWithArrangement(
  input: NewSongInput,
): Promise<{ songId: string; arrangementId: string }> {
  const sourceKey = deriveSourceKey(input.chordproBody);
  const sql = getSql();

  const rows = (await sql`
    with inserted_song as (
      insert into song (title, authors, ccli_number, copyright, default_key, notes)
      values (${input.title}, ${input.authors ?? null}, ${input.ccliNumber ?? null},
              ${input.copyright ?? null}, ${input.defaultKey ?? null}, ${input.notes ?? null})
      returning id
    ), inserted_arrangement as (
      -- D-07: 'unverified' — entering a chart isn't the same as checking it.
      insert into arrangement (song_id, name, chordpro_body, source_key, review_status, extraction_method)
      select id, ${input.arrangementName || "Default"}, ${input.chordproBody}, ${sourceKey},
             'unverified', 'manual'
      from inserted_song
      returning id
    )
    select inserted_song.id as song_id, inserted_arrangement.id as arrangement_id
    from inserted_song, inserted_arrangement
  `) as { song_id: string; arrangement_id: string }[];

  return { songId: rows[0].song_id, arrangementId: rows[0].arrangement_id };
}

export async function updateSong(
  id: string,
  input: Omit<NewSongInput, "chordproBody" | "arrangementName">,
): Promise<void> {
  const sql = getSql();
  await sql`
    update song set
      title = ${input.title},
      authors = ${input.authors ?? null},
      ccli_number = ${input.ccliNumber ?? null},
      copyright = ${input.copyright ?? null},
      default_key = ${input.defaultKey ?? null},
      notes = ${input.notes ?? null}
    where id = ${id}
  `;
}

export async function deleteSong(id: string): Promise<void> {
  const sql = getSql();
  try {
    // arrangement.song_id cascades, but each arrangement is then subject to
    // service_item's `on delete restrict` — so a song in a setlist can't go.
    await sql`delete from song where id = ${id}`;
  } catch (err) {
    if (isForeignKeyViolation(err)) {
      throw new RecordInUseError(
        "One or more of this song's arrangements are used in a service. Remove them from those services before deleting the song.",
      );
    }
    throw err;
  }
}
