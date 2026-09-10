// Demo song library. Five public-domain hymns, fully chorded through every
// verse, so a fresh deploy has something real to click through when the team is
// giving feedback. NOT part of the schema and NOT run by `vercel-build` — it's a
// hand-run script, like `db/migrate.mjs`. Run with tsx (like `npm run digitize`)
// so it can reuse the app's own `deriveSourceKey`.
//
// Ownership: every row this creates is marked `song.origin = 'demo_seed'`
// (migration 0003, D-19). The seeder only ever updates rows it owns. A song with
// a matching title but `origin = 'user'` — e.g. a real chart from the
// digitization batch — is never overwritten; it's adopted only if it's still
// pristine demo-shaped data (unverified, no scan, manual), otherwise skipped
// loudly and the run exits non-zero.
//
// Idempotent: re-running with no chart changes is a no-op. When it does rewrite
// an existing body it snapshots the old one into `arrangement_revision` first,
// the same undo guarantee `updateArrangement` gives (D-06).
//
// Usage:
//   npm run db:seed:demo              # local dev branch (--env-file=.env.local)
//   npm run db:seed:demo:prod         # Neon `main` branch (needs an authed Neon CLI)
//   npm run db:seed:demo -- --purge   # delete every origin='demo_seed' song
//   tsx db/seed-demo.ts --neon-branch <name>

import { execFileSync } from "node:child_process";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { deriveSourceKey } from "../lib/db/validation";

const NEON_PROJECT_ID = process.env.NEON_PROJECT_ID ?? "late-sun-48292829";

// Same resolution rule as db/migrate.mjs: an explicit DATABASE_URL wins,
// otherwise `--neon-branch <name>` asks the Neon CLI for a connection string.
function resolveDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const flagIndex = process.argv.indexOf("--neon-branch");
  if (flagIndex !== -1) {
    const branch = process.argv[flagIndex + 1];
    if (!branch) {
      throw new Error("--neon-branch needs a branch name, e.g. --neon-branch main");
    }
    let out: string;
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
    "DATABASE_URL is not set. Use `npm run db:seed:demo` for the local dev branch " +
      "or `npm run db:seed:demo:prod` for production.",
  );
}

function describeTarget(databaseUrl: string): string {
  try {
    const u = new URL(databaseUrl);
    return `${u.host}${u.pathname}`;
  } catch {
    return "(unparseable DATABASE_URL)";
  }
}

// ---------------------------------------------------------------------------
// The charts. Strophic hymns: every verse sings to verse 1's tune, so verse 1's
// progression is repeated over the matching syllables in every later verse.
// ---------------------------------------------------------------------------

export interface DemoSong {
  title: string;
  authors: string;
  defaultKey: string;
  chordpro: string;
}

export const DEMO_SONGS: DemoSong[] = [
  {
    title: "Amazing Grace",
    authors: "John Newton",
    defaultKey: "G",
    chordpro: `{title: Amazing Grace}
{artist: John Newton}
{key: G}
{tempo: 72}
{time: 3/4}

{start_of_verse: Verse 1}
[G]Amazing [G7]grace, how [C]sweet the [G]sound
That saved a [Em]wretch like [D]me
[G]I once was [G7]lost, but [C]now am [G]found
Was [Em]blind, but [D]now I [G]see
{end_of_verse}

{start_of_verse: Verse 2}
[G]'Twas grace that [G7]taught my [C]heart to [G]fear
And grace my [Em]fears re[D]lieved
[G]How precious [G7]did that [C]grace ap[G]pear
The [Em]hour I [D]first be[G]lieved
{end_of_verse}

{start_of_verse: Verse 3}
[G]Through many [G7]dangers, [C]toils and [G]snares
I have al[Em]ready [D]come
[G]'Tis grace hath [G7]brought me [C]safe thus [G]far
And [Em]grace will [D]lead me [G]home
{end_of_verse}

{start_of_verse: Verse 4}
[G]When we've been [G7]there ten [C]thousand [G]years
Bright shining [Em]as the [D]sun
[G]We've no less [G7]days to [C]sing God's [G]praise
Than [Em]when we'd [D]first be[G]gun
{end_of_verse}`,
  },

  {
    title: "Be Thou My Vision",
    authors: "Ancient Irish; tr. Mary E. Byrne / Eleanor H. Hull",
    defaultKey: "D",
    chordpro: `{title: Be Thou My Vision}
{subtitle: Ancient Irish hymn, tr. Mary E. Byrne}
{key: D}
{tempo: 96}
{time: 3/4}

{start_of_verse: Verse 1}
[D]Be Thou my [Em]vision, O [G]Lord of my [D]heart
[D]Naught be all [Em]else to me, [A]save that Thou [Asus4]art[A]
[D]Thou my best [Bm]thought, by [G]day or by [D]night
[Bm]Waking or [A]sleeping, Thy [G]presence my [D]light
{end_of_verse}

{start_of_verse: Verse 2}
[D]Be Thou my [Em]wisdom, and [G]Thou my true [D]word
[D]I ever with [Em]Thee and [A]Thou with me, [Asus4]Lord[A]
[D]Thou my great [Bm]Father, [G]I Thy true [D]son
[Bm]Thou in me [A]dwelling, and [G]I with Thee [D]one
{end_of_verse}

{start_of_verse: Verse 3}
[D]Riches I [Em]heed not, nor [G]man's empty [D]praise
[D]Thou mine in[Em]heritance, [A]now and al[Asus4]ways[A]
[D]Thou and Thou [Bm]only, [G]first in my [D]heart
[Bm]High King of [A]heaven, my [G]treasure Thou [D]art
{end_of_verse}

{start_of_verse: Verse 4}
[D]High King of [Em]heaven, my [G]victory [D]won
[D]May I reach [Em]heaven's joys, [A]O bright heaven's [Asus4]Sun[A]
[D]Heart of my [Bm]own heart, [G]whatever be[D]fall
[Bm]Still be my [A]vision, O [G]Ruler of [D]all
{end_of_verse}`,
  },

  {
    title: "Come Thou Fount of Every Blessing",
    authors: "Robert Robinson",
    defaultKey: "D",
    chordpro: `{title: Come Thou Fount of Every Blessing}
{artist: Robert Robinson}
{key: D}
{tempo: 84}
{time: 4/4}

{start_of_verse: Verse 1}
[D]Come, Thou Fount of [G]every [D]blessing
Tune my [A]heart to [A7]sing Thy [D]grace
[D]Streams of mercy, [G]never [D]ceasing
Call for [A]songs of [A7]loudest [D]praise
[A]Teach me some me[D]lodious [G]sonnet
Sung by [D]flaming [A7]tongues a[D]bove
[D]Praise the mount, I'm [G]fixed up[D]on it
Mount of [A]Thy re[A7]deeming [D]love
{end_of_verse}

{start_of_verse: Verse 2}
[D]Here I raise mine [G]Eben[D]ezer
Hither [A]by Thy [A7]help I'm [D]come
[D]And I hope, by [G]Thy good [D]pleasure
Safely [A]to ar[A7]rive at [D]home
[A]Jesus sought me [D]when a [G]stranger
Wand'ring [D]from the [A7]fold of [D]God
[D]He, to rescue [G]me from [D]danger
Inter[A]posed His [A7]precious [D]blood
{end_of_verse}

{start_of_verse: Verse 3}
[D]O to grace how [G]great a [D]debtor
Daily [A]I'm con[A7]strained to [D]be
[D]Let Thy goodness, [G]like a [D]fetter
Bind my [A]wand'ring [A7]heart to [D]Thee
[A]Prone to wander, [D]Lord, I [G]feel it
Prone to [D]leave the [A7]God I [D]love
[D]Here's my heart, O [G]take and [D]seal it
Seal it [A]for Thy [A7]courts a[D]bove
{end_of_verse}`,
  },

  {
    title: "Holy, Holy, Holy! Lord God Almighty",
    authors: "Reginald Heber",
    defaultKey: "D",
    chordpro: `{title: Holy, Holy, Holy! Lord God Almighty}
{artist: Reginald Heber}
{key: D}
{tempo: 100}
{time: 4/4}

{start_of_verse: Verse 1}
[D]Holy, holy, [A]holy! [D]Lord God Al[A]mighty!
[D]Early in the [G]morning our [D]song shall rise to [A]Thee
[D]Holy, holy, [A]holy! [D]Merciful and [A]mighty!
[G]God in three [D]Persons, [G]blessed [D]Trin[A]i[D]ty!
{end_of_verse}

{start_of_verse: Verse 2}
[D]Holy, holy, [A]holy! [D]All the saints a[A]dore Thee
[D]Casting down their [G]golden crowns a[D]round the glassy [A]sea
[D]Cherubim and [A]seraphim [D]falling down be[A]fore Thee
[G]Which wert, and [D]art, and [G]ever[D]more [A]shalt [D]be
{end_of_verse}

{start_of_verse: Verse 3}
[D]Holy, holy, [A]holy! [D]Though the darkness [A]hide Thee
[D]Though the eye of [G]sinful man [D]Thy glory may not [A]see
[D]Only Thou art [A]holy; [D]there is none be[A]side Thee
[G]Perfect in [D]power, [G]in [D]love, and [A]pu[D]rity
{end_of_verse}

{start_of_verse: Verse 4}
[D]Holy, holy, [A]holy! [D]Lord God Al[A]mighty!
[D]All Thy works shall [G]praise Thy name [D]in earth and sky and [A]sea
[D]Holy, holy, [A]holy! [D]Merciful and [A]mighty!
[G]God in three [D]Persons, [G]blessed [D]Trin[A]i[D]ty!
{end_of_verse}`,
  },

  {
    title: "It Is Well with My Soul",
    authors: "Horatio G. Spafford / Philip P. Bliss",
    defaultKey: "C",
    chordpro: `{title: It Is Well with My Soul}
{artist: Horatio G. Spafford}
{key: C}
{tempo: 90}
{time: 4/4}

{start_of_verse: Verse 1}
[C]When peace like a river at[F]tendeth my [C]way
When [C]sorrows like sea billows [G]roll
[C]Whatever my lot, Thou hast [F]taught me to [C]say
It is [C]well, [G]it is well with my [C]soul
{end_of_verse}

{start_of_chorus}
It is [C]well ([F]it is [C]well)
With my [C]soul ([G]with my [G7]soul)
It is [C]well, it is [F]well with my [C]soul
{end_of_chorus}

{start_of_verse: Verse 2}
[C]Though Satan should buffet, though [F]trials should [C]come
Let [C]this blest assurance con[G]trol
[C]That Christ has regarded my [F]helpless es[C]tate
And hath [C]shed [G]His own blood for my [C]soul
{end_of_verse}

{start_of_verse: Verse 3}
[C]My sin, oh the bliss of this [F]glorious [C]thought
My [C]sin, not in part but the [G]whole
[C]Is nailed to the cross, and I [F]bear it no [C]more
Praise the [C]Lord, [G]praise the Lord, O my [C]soul
{end_of_verse}

{start_of_verse: Verse 4}
[C]And, Lord, haste the day when my [F]faith shall be [C]sight
The [C]clouds be rolled back as a [G]scroll
[C]The trump shall resound and the [F]Lord shall de[C]scend
Even [C]so, [G]it is well with my [C]soul
{end_of_verse}`,
  },
];

interface ExistingRow {
  song_id: string;
  origin: string;
  title_count: number;
  arr_id: string | null;
  body: string | null;
  review_status: string | null;
  scan_pdf_path: string | null;
  extraction_method: string | null;
}

// A row that still looks like the pristine demo chart the app produces for a
// hand-typed song: unverified, no scan attached, extracted "manually". Anything
// touched by the digitization pipeline or a verifier fails this and is left be.
function looksLikePristineDemo(row: ExistingRow): boolean {
  return (
    row.review_status !== "verified" &&
    row.scan_pdf_path === null &&
    (row.extraction_method === null || row.extraction_method === "manual")
  );
}

async function insertDemoSong(
  sql: NeonQueryFunction<false, false>,
  song: DemoSong,
  sourceKey: string,
): Promise<void> {
  const rows = (await sql`
    insert into song (title, authors, default_key, origin)
    values (${song.title}, ${song.authors}, ${song.defaultKey}, 'demo_seed')
    returning id
  `) as { id: string }[];
  await sql`
    insert into arrangement
      (song_id, name, chordpro_body, source_key, review_status, extraction_method)
    values
      (${rows[0].id}, 'Default', ${song.chordpro}, ${sourceKey}, 'unverified', 'manual')
  `;
}

// Rewrite the Default arrangement's body, snapshotting the old one into
// arrangement_revision first (D-06) — mirrors updateArrangement().
function rewriteBody(
  sql: NeonQueryFunction<false, false>,
  row: ExistingRow,
  song: DemoSong,
  sourceKey: string,
) {
  return sql.transaction([
    sql`
      insert into arrangement_revision (arrangement_id, chordpro_body, note)
      values (${row.arr_id}, ${row.body}, 'before db/seed-demo.ts overwrite')
    `,
    sql`
      update arrangement
      set chordpro_body = ${song.chordpro}, source_key = ${sourceKey}, updated_at = now()
      where id = ${row.arr_id}
    `,
  ]);
}

async function seed(sql: NeonQueryFunction<false, false>): Promise<void> {
  let inserted = 0;
  let updated = 0;
  let unchanged = 0;
  let skipped = 0;

  for (const song of DEMO_SONGS) {
    const sourceKey = deriveSourceKey(song.chordpro);

    const rows = (await sql`
      select
        s.id as song_id,
        s.origin,
        (select count(*)::int from song where title = ${song.title}) as title_count,
        a.id as arr_id,
        a.chordpro_body as body,
        a.review_status,
        a.scan_pdf_path,
        a.extraction_method
      from song s
      left join arrangement a on a.song_id = s.id and a.name = 'Default'
      where s.title = ${song.title}
      order by (s.origin = 'demo_seed') desc, s.created_at asc
      limit 1
    `) as ExistingRow[];

    if (rows.length === 0) {
      await insertDemoSong(sql, song, sourceKey);
      inserted++;
      console.log(`  + inserted "${song.title}"`);
      continue;
    }

    const row = rows[0];

    // A real (non-demo) song owns this title. Only adopt it if it's still
    // pristine demo-shaped data and unambiguous; otherwise never touch it.
    if (row.origin !== "demo_seed") {
      if (row.title_count > 1 || !looksLikePristineDemo(row)) {
        console.warn(
          `  ! SKIPPED "${song.title}": a non-demo song with this title already ` +
            `exists (origin=${row.origin}, review_status=${row.review_status}, ` +
            `scan=${row.scan_pdf_path ? "yes" : "no"}). Not overwriting.`,
        );
        skipped++;
        continue;
      }
      await sql`update song set origin = 'demo_seed' where id = ${row.song_id}`;
    }

    await sql`
      update song set authors = ${song.authors}, default_key = ${song.defaultKey}
      where id = ${row.song_id}
    `;

    if (row.arr_id === null) {
      await sql`
        insert into arrangement
          (song_id, name, chordpro_body, source_key, review_status, extraction_method)
        values
          (${row.song_id}, 'Default', ${song.chordpro}, ${sourceKey}, 'unverified', 'manual')
      `;
      updated++;
      console.log(`  + added "Default" arrangement for "${song.title}"`);
      continue;
    }

    if (row.body === song.chordpro && row.origin === "demo_seed") {
      unchanged++;
      console.log(`  = "${song.title}" already current`);
      continue;
    }

    await rewriteBody(sql, row, song, sourceKey);
    updated++;
    console.log(
      row.origin === "demo_seed"
        ? `  ~ updated "${song.title}"`
        : `  ~ adopted and updated "${song.title}"`,
    );
  }

  console.log(
    `Done: ${inserted} inserted, ${updated} updated, ${unchanged} unchanged, ${skipped} skipped.`,
  );
  if (skipped > 0) {
    console.error(
      `\n${skipped} song(s) skipped — a real song already owns that title. ` +
        `Resolve by hand if the demo chart is still wanted.`,
    );
    process.exitCode = 1;
  }
}

async function purge(sql: NeonQueryFunction<false, false>): Promise<void> {
  const doomed = (await sql`
    select title from song where origin = 'demo_seed' order by title
  `) as { title: string }[];
  if (doomed.length === 0) {
    console.log("No origin='demo_seed' songs to purge.");
    return;
  }
  try {
    await sql`delete from song where origin = 'demo_seed'`;
  } catch (err) {
    // 23001 restrict_violation / 23503 foreign_key_violation: a demo
    // arrangement is still referenced by service_item (on delete restrict).
    const code = (err as { code?: string }).code;
    if (code === "23001" || code === "23503") {
      throw new Error(
        "Can't purge: a demo song is still used in a service. Remove it from " +
          "that setlist first, then re-run --purge.",
      );
    }
    throw err;
  }
  console.log(`Purged ${doomed.length} demo song(s):`);
  for (const d of doomed) console.log(`  - ${d.title}`);
}

async function main(): Promise<void> {
  const databaseUrl = resolveDatabaseUrl();
  const sql = neon(databaseUrl);
  const purging = process.argv.includes("--purge");
  console.log(
    `${purging ? "Purging demo songs from" : "Seeding demo songs into"} ${describeTarget(databaseUrl)}`,
  );
  await (purging ? purge(sql) : seed(sql));
}

// Run only when invoked directly, not when DEMO_SONGS is imported by a test.
if (/(?:^|[/\\])seed-demo\.[cm]?[jt]s$/.test(process.argv[1] ?? "")) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
