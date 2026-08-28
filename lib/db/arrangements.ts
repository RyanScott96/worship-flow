import { getSql } from "./client";
import {
  deriveSourceKey,
  isForeignKeyViolation,
  RecordInUseError,
} from "./validation";
import type { ArrangementRow } from "./types";

export async function getArrangement(
  id: string,
): Promise<(ArrangementRow & { song_title: string }) | null> {
  const sql = getSql();
  const rows = (await sql`
    select arrangement.*, song.title as song_title
    from arrangement
    join song on song.id = arrangement.song_id
    where arrangement.id = ${id}
  `) as (ArrangementRow & { song_title: string })[];
  return rows[0] ?? null;
}

export interface NewArrangementInput {
  name?: string;
  chordproBody: string;
  bpm?: number;
  timeSignature?: string;
}

export async function createArrangement(
  songId: string,
  input: NewArrangementInput,
): Promise<{ arrangementId: string }> {
  const sourceKey = deriveSourceKey(input.chordproBody);
  const sql = getSql();
  // D-07: verification is a deliberate act. Typing a chart in is not the same
  // as someone having checked it against the source, so it lands 'unverified'.
  const rows = (await sql`
    insert into arrangement (song_id, name, chordpro_body, source_key, bpm, time_signature,
                              review_status, extraction_method)
    values (${songId}, ${input.name || "Default"}, ${input.chordproBody}, ${sourceKey},
            ${input.bpm ?? null}, ${input.timeSignature ?? null}, 'unverified', 'manual')
    returning id
  `) as { id: string }[];
  return { arrangementId: rows[0].id };
}

export interface UpdateArrangementInput {
  name?: string;
  chordproBody: string;
  bpm?: number;
  timeSignature?: string;
}

/**
 * Updates the arrangement and appends a revision snapshot in one atomic
 * round trip (D-06: every edit must be undoable). `verified_by`/`edited_by`
 * stay null — no accounts system yet, see docs/DECISIONS.md.
 */
export async function updateArrangement(
  id: string,
  input: UpdateArrangementInput,
): Promise<void> {
  const sourceKey = deriveSourceKey(input.chordproBody);
  const sql = getSql();
  await sql.transaction([
    sql`
      update arrangement set
        name = ${input.name || "Default"},
        chordpro_body = ${input.chordproBody},
        source_key = ${sourceKey},
        bpm = ${input.bpm ?? null},
        time_signature = ${input.timeSignature ?? null},
        updated_at = now()
      where id = ${id}
    `,
    sql`
      insert into arrangement_revision (arrangement_id, chordpro_body)
      values (${id}, ${input.chordproBody})
    `,
  ]);
}

export async function deleteArrangement(id: string): Promise<void> {
  const sql = getSql();
  try {
    await sql`delete from arrangement where id = ${id}`;
  } catch (err) {
    if (isForeignKeyViolation(err)) {
      throw new RecordInUseError(
        "This arrangement is used in one or more services. Remove it from those services before deleting it.",
      );
    }
    throw err;
  }
}
