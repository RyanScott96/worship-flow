-- Worship app schema. Postgres 16+.
-- Phase 1 tables are required. Phase 3/5 tables are marked and can be deferred.
-- See docs/DECISIONS.md for why the model is shaped this way.

create extension if not exists "uuid-ossp";
-- Phase 5 only. Harmless to enable early.
create extension if not exists vector;

-- ---------------------------------------------------------------------------
-- PHASE 1 — song library
-- ---------------------------------------------------------------------------

-- Identity only. Scheduling (assignment/blackout, Phase 3, D-15) is deferred
-- and may never be built, but D-06 (edit attribution) and D-07 (verification)
-- need a person to attribute to regardless.
create table person (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  email       text unique not null,
  role        text not null default 'member'
              check (role in ('admin','leader','member')),
  created_at  timestamptz not null default now()
);

-- The work itself. Not the chart.
create table song (
  id            uuid primary key default uuid_generate_v4(),
  title         text not null,
  authors       text,
  ccli_number   text,                    -- needed for CCLI usage reporting
  copyright     text,
  default_key   text,                    -- a hint for new setlists, NOT authoritative
  notes         text,
  created_at    timestamptz not null default now()
);

create index song_title_trgm on song using gin (title gin_trgm_ops);

-- A specific chart. The church's version differs from the published one:
-- extra bridge, no second verse, different intro. Keep both.
create table arrangement (
  id              uuid primary key default uuid_generate_v4(),
  song_id         uuid not null references song(id) on delete cascade,
  name            text not null default 'Default',
  chordpro_body   text not null,         -- canonical. see docs/DOMAIN.md
  source_key      text not null,         -- key the chordpro_body is written in
  bpm             int,
  time_signature  text,

  -- D-05: the scan is retained forever and is the authority the ChordPro derives from
  scan_pdf_path       text,
  scan_page_count     int,

  -- D-07: verification is deliberate; "played" does not imply "verified"
  review_status   text not null default 'unverified'
                  check (review_status in ('unverified','verified','flagged')),
  review_note     text,                  -- what's wrong, when flagged
  verified_at     timestamptz,
  verified_by     uuid references person(id),

  -- provenance from the digitization run
  extraction_method     text,            -- 'vlm' | 'ocr_geometric' | 'manual'
  extraction_warnings   jsonb,           -- validator output: unparseable chords, etc.

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index arrangement_song on arrangement(song_id);
create index arrangement_status on arrangement(review_status)
  where review_status <> 'verified';

-- Per-page viewer derivatives. PDF is archive; WebP is what the compare view loads.
create table arrangement_page (
  id              uuid primary key default uuid_generate_v4(),
  arrangement_id  uuid not null references arrangement(id) on delete cascade,
  page_number     int not null,
  image_path      text not null,
  unique (arrangement_id, page_number)
);

-- D-06: anyone can edit, so every edit must be undoable. Append-only.
create table arrangement_revision (
  id              uuid primary key default uuid_generate_v4(),
  arrangement_id  uuid not null references arrangement(id) on delete cascade,
  chordpro_body   text not null,         -- full snapshot; these are ~5KB, don't optimize
  edited_by       uuid references person(id),
  edited_at       timestamptz not null default now(),
  note            text
);

create index arrangement_revision_lookup
  on arrangement_revision(arrangement_id, edited_at desc);

-- ---------------------------------------------------------------------------
-- PHASE 2 — services and setlists
-- ---------------------------------------------------------------------------

create table service (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  starts_at   timestamptz not null,
  notes       text,
  created_at  timestamptz not null default now()
);

-- D-02: key and capo live HERE, not on song or arrangement.
-- The same song is played in different keys depending on who leads.
create table service_item (
  id              uuid primary key default uuid_generate_v4(),
  service_id      uuid not null references service(id) on delete cascade,
  position        int not null,

  -- song items reference an arrangement; non-song items (welcome, prayer,
  -- sermon, announcements) leave it null and use `title`
  arrangement_id  uuid references arrangement(id) on delete restrict,
  title           text,
  item_type       text not null default 'song'
                  check (item_type in ('song','prayer','sermon','announcement','other')),

  key_override    text,                  -- the key FOR THIS SERVICE
  capo            int,                   -- per-service, per-player choice
  duration_secs   int,
  notes           text,

  unique (service_id, position) deferrable initially deferred,
  check (item_type <> 'song' or arrangement_id is not null)
);

create index service_item_service on service_item(service_id, position);
create index service_item_arrangement on service_item(arrangement_id);

-- Rotation data falls out of the setlist join for free. This is the answer to
-- "what have we actually played", which is otherwise unknowable without
-- scraping livestreams. Feeds both CCLI reporting and Phase 5 ranking.
create view song_usage as
select
  a.song_id,
  count(*) filter (where s.starts_at < now())      as times_played,
  max(s.starts_at) filter (where s.starts_at < now()) as last_played_at
from service_item si
join arrangement a on a.id = si.arrangement_id
join service s     on s.id = si.service_id
group by a.song_id;

-- ---------------------------------------------------------------------------
-- PHASE 3 — scheduling (D-15: deferred, may never be built)
-- `person` itself lives in the Phase 1 section above — verification and edit
-- attribution need it regardless of whether scheduling ships.
-- ---------------------------------------------------------------------------

create table assignment (
  id          uuid primary key default uuid_generate_v4(),
  service_id  uuid not null references service(id) on delete cascade,
  person_id   uuid not null references person(id) on delete cascade,
  position    text not null,             -- 'vocals','keys','drums','bass','sound','media'
  status      text not null default 'invited'
              check (status in ('invited','accepted','declined')),
  unique (service_id, person_id, position)
);

create table blackout (
  id          uuid primary key default uuid_generate_v4(),
  person_id   uuid not null references person(id) on delete cascade,
  start_date  date not null,
  end_date    date not null,
  reason      text,
  check (end_date >= start_date)
);

-- ---------------------------------------------------------------------------
-- PHASE 5 — theme matching (D-12, D-13)
-- ---------------------------------------------------------------------------

-- D-13: embed the enriched description, NOT raw lyrics.
create table song_enrichment (
  song_id           uuid primary key references song(id) on delete cascade,
  themes            text[],
  scripture_refs    text[],              -- structured; enables exact passage lookup
  liturgical_use    text,                -- 'gathering','response','communion','sending'
  energy            int check (energy between 1 and 5),
  description       text not null,       -- the text that gets embedded
  embedding         vector(1536),
  model             text,
  generated_at      timestamptz not null default now()
);

-- D-12: NO ivfflat/hnsw index. 300 rows brute-force in single-digit ms with
-- perfect recall, and skipping the index avoids the ~2000-dim index ceiling.

create table sermon_input (
  id            uuid primary key default uuid_generate_v4(),
  service_id    uuid references service(id) on delete set null,
  scripture_ref text,
  topic         text,
  body_text     text,                    -- may be WIP; regenerate freely
  embedding     vector(1536),
  source        text,                    -- 'email' | 'manual' | 'doc'
  received_at   timestamptz not null default now()
);
