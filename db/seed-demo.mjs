// Demo song library. Five public-domain hymns, fully chorded through every
// verse, so a fresh deploy has something real to click through when the team is
// giving feedback. NOT part of the schema and NOT run by `vercel-build` — it's a
// hand-run script, like `db/migrate.mjs`.
//
// Properties:
//   - Idempotent. Matches an existing song by exact title and updates its
//     "Default" arrangement in place; inserts only what's missing. Safe to
//     re-run, safe to run after hand-editing a chart in the app (it will
//     overwrite that chart back to what's here — this is demo data).
//   - Purely additive. It never deletes. Clearing the library before real
//     digitization (see docs/ROADMAP.md) is a separate, deliberate step.
//   - No revision rows. Seeding is not a user edit, so it doesn't append to
//     `arrangement_revision` the way the app's save path does.
//
// Usage:
//   npm run db:seed:demo         # local dev branch (--env-file=.env.local)
//   npm run db:seed:demo:prod    # Neon `main` branch (needs an authed Neon CLI)
//   DATABASE_URL=... node db/seed-demo.mjs
//   node db/seed-demo.mjs --neon-branch <name>

import { execFileSync } from "node:child_process";
import { neon } from "@neondatabase/serverless";

const NEON_PROJECT_ID = process.env.NEON_PROJECT_ID ?? "late-sun-48292829";

// Same resolution rule as db/migrate.mjs: an explicit DATABASE_URL wins,
// otherwise `--neon-branch <name>` asks the Neon CLI for a connection string.
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
    "DATABASE_URL is not set. Use `npm run db:seed:demo` for the local dev branch " +
      "or `npm run db:seed:demo:prod` for production.",
  );
}

function describeTarget(databaseUrl) {
  try {
    const u = new URL(databaseUrl);
    return `${u.host}${u.pathname}`;
  } catch {
    return "(unparseable DATABASE_URL)";
  }
}

// `arrangement.source_key` is derived from the chart's {key: ...} line — the app
// does the same in deriveSourceKey(). These charts all carry a clean key line,
// so a plain regex matches that behaviour without pulling the TS lib into a .mjs.
function keyFromChordpro(body, title) {
  const m = /^\{key:\s*(.+?)\}\s*$/m.exec(body);
  if (!m) throw new Error(`"${title}" has no {key: ...} line`);
  return m[1].trim();
}

// ---------------------------------------------------------------------------
// The charts. Strophic hymns: every verse sings to verse 1's tune, so verse 1's
// progression is repeated over the matching syllables in every later verse.
// ---------------------------------------------------------------------------

const DEMO_SONGS = [
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

async function main() {
  const databaseUrl = resolveDatabaseUrl();
  const sql = neon(databaseUrl);
  console.log(`Seeding demo songs into ${describeTarget(databaseUrl)}`);

  let inserted = 0;
  let updated = 0;
  let unchanged = 0;

  for (const song of DEMO_SONGS) {
    const sourceKey = keyFromChordpro(song.chordpro, song.title);

    const existing = await sql`select id from song where title = ${song.title}`;
    let songId;

    if (existing.length === 0) {
      const rows = await sql`
        insert into song (title, authors, default_key)
        values (${song.title}, ${song.authors}, ${song.defaultKey})
        returning id
      `;
      songId = rows[0].id;
      await sql`
        insert into arrangement
          (song_id, name, chordpro_body, source_key, review_status, extraction_method)
        values
          (${songId}, 'Default', ${song.chordpro}, ${sourceKey}, 'unverified', 'manual')
      `;
      inserted++;
      console.log(`  + inserted "${song.title}"`);
      continue;
    }

    songId = existing[0].id;
    await sql`
      update song set authors = ${song.authors}, default_key = ${song.defaultKey}
      where id = ${songId}
    `;

    const arr = await sql`
      select id, chordpro_body from arrangement
      where song_id = ${songId} and name = 'Default'
    `;

    if (arr.length === 0) {
      await sql`
        insert into arrangement
          (song_id, name, chordpro_body, source_key, review_status, extraction_method)
        values
          (${songId}, 'Default', ${song.chordpro}, ${sourceKey}, 'unverified', 'manual')
      `;
      updated++;
      console.log(`  + added "Default" arrangement for "${song.title}"`);
      continue;
    }

    if (arr[0].chordpro_body === song.chordpro) {
      unchanged++;
      console.log(`  = "${song.title}" already current`);
      continue;
    }

    await sql`
      update arrangement
      set chordpro_body = ${song.chordpro}, source_key = ${sourceKey}, updated_at = now()
      where id = ${arr[0].id}
    `;
    updated++;
    console.log(`  ~ updated "${song.title}"`);
  }

  console.log(
    `Done: ${inserted} inserted, ${updated} updated, ${unchanged} unchanged.`,
  );
}

// Run only when invoked directly (`node db/seed-demo.mjs`), not when the chart
// list is imported for a test.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err.message ?? err);
    process.exit(1);
  });
}

export { DEMO_SONGS };
