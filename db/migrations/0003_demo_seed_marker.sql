-- Marks the songs loaded by db/seed-demo.mjs so the seeder can recognise its own
-- rows. Without a marker it matches by title alone, and the five hymns it seeds
-- ("Amazing Grace", "It Is Well with My Soul", ...) are exactly the kind of
-- titles the ~300-chart digitization batch (docs/ROADMAP.md, D-16) will contain.
-- A prod re-run could then overwrite a real, verified, scan-backed chart with
-- generic demo text. `origin` lets the seeder touch only 'demo_seed' rows, and
-- makes "clear the demo library before digitization" a one-liner. See D-19.

alter table song add column if not exists origin text not null default 'user';

alter table song add constraint song_origin_check
  check (origin in ('user', 'demo_seed'));

-- Every branch's library today is exactly this demo set, hand-entered before the
-- marker existed. Adopt those rows so the first post-migration seed run updates
-- in place instead of inserting duplicates. Titles that don't match stay 'user'.
update song set origin = 'demo_seed'
  where title in (
    'Amazing Grace',
    'Be Thou My Vision',
    'Come Thou Fount of Every Blessing',
    'Holy, Holy, Holy! Lord God Almighty',
    'It Is Well with My Soul'
  );
