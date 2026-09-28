# Roadmap

**Pivoted 2026-09-28** from a church worship-team tool to a personal **practice and learning**
tool for guitar charts: think Ultimate Guitar Tabs, but centered on your own charts and on
getting better at playing them, not on a public catalog. See D-22 for why and what carried
over.

Build in this order. Each phase is independently useful — if the project stalls after any
one of them, what exists is still worth having.

---

## Why the pivot

The church turned out to have paid for CCLI SongSelect for years; nobody knew it was set up.
Everyone is being onboarded to it now. That covers the library, transposition, and setlists
this app was going to give them, so the church use case is gone.

The pieces worth keeping are the ones that were never church-specific: a ChordPro library,
the transposition module, and the chart viewer. They're also the base of a practice tool.

## Mobile first

The church plan targeted desktop for editing and tablets on a music stand for reading. The
practice tool targets **the phone**: it's what's already in your pocket when you pick up a
guitar. Every screen is designed at phone width (~360–430px, portrait) first, and tablet and
desktop are the enhanced cases, not the reverse. See D-23.

What that means across every phase:
- **Thumb reach.** Practice controls (play/stop, tempo, loop, key) live in a bottom bar, not
  a toolbar across the top. Touch targets are at least 44px. No hover-only affordances.
- **The chart owns the screen.** Controls collapse out of the way while playing; one tap
  brings them back.
- **Readable at arm's length on a stand or in your lap.** Type scale is tuned for a phone
  held further away than reading distance, not for a tablet at music-stand distance.
- **Installable PWA.** Home-screen icon, fullscreen launch, no browser chrome eating
  vertical space.
- **Offline matters more.** Phones practice in places with bad signal. See Later.

## Who it's for, and what it will never host

- **Primary user: the author.** It's open source, so others may pick it up. Let that happen
  on its own; don't design for it ahead of time.
- **Bring your own charts.** Users keep their own charts for their own practice: typed,
  imported `.pro`/text, or OCR'd from their own paper. **The project never hosts music for
  others**: no public catalog, no "submit a tab," no shared song pages. That keeps copyright
  where it belongs (with whoever holds the chart and its license) and keeps this out of
  Ultimate Guitar's legal territory. See D-22.
- **Open question: how a second user runs it.** The lean is *self-host your own instance*
  (clone, point it at your own Postgres, deploy), which keeps "we don't host music" true by
  construction. Accounts with private libraries on a shared instance would still be hosting
  other people's charts. Decide only when a second user actually shows up.

---

## Done · Library, transposition, viewer (carried over)

Built for the church and kept as-is. This is the foundation everything below builds on.

- ChordPro parser/renderer; ChordPro stays canonical (D-01).
- **Transposition module**: pure, no I/O, heaviest test suite in the repo. Read
  `docs/DOMAIN.md` §3 before touching it.
- Song/arrangement CRUD, ChordPro editor with live preview.
- Render modes off one source: chords+lyrics, lyrics only, Nashville numbers.
- `.pro` export. Still the bus-factor insurance: your library outlives this app.
- Chords-above-lyrics renderer (D-18), single-arrangement viewer with key/capo/mode controls,
  Wake Lock, arrow-key nav.
- `scripts/digitize/`: OCR your own paper charts into ChordPro. Kept as a personal import
  path; the church's ~300-chart batch is cancelled (see Archived). Its known gaps are
  documented under Archived and in `docs/DIGITIZATION.md`.

---

## Phase 0 · Mobile-first pass and design system

Before adding practice features, make the existing surfaces phone-native and move them onto
a real design system, so Phase 1 builds on both instead of retrofitting them. Do the two
together: both touch every component, so one pass is cheaper than two. See D-24.

- **Design tokens.** Today's theme is two colors (`--background`/`--foreground` in
  `app/globals.css`, flipped by `prefers-color-scheme`), and components hardcode
  `text-black/50 dark:text-white/50`-style opacities. Replace that with semantic tokens: the
  shadcn set (`background`, `foreground`, `primary`, `muted`, `accent`, `card`, `border`,
  `ring`, `destructive`) plus app tokens: `chord` (chords colored apart from lyrics, a
  readability win and not just decoration), `section-label`, `beat`/`beat-accent`
  (metronome), and practice-status colors for Phase 3. **The author picks the palette**; its
  values drop into these tokens. The token names and wiring can land first with neutral
  placeholder values, so this phase isn't blocked on the palette.
- **Light, dark, and high-contrast**, each defined from the palette. Follow the system by
  default, with a manual override. Keep a high-contrast variant: pure black and white still
  wins on a stand in bright light. Chord and lyric text must meet WCAG AA (4.5:1) against
  the background in every variant. Print stays black-on-white regardless of theme.
- **shadcn/ui components** replace the hand-rolled buttons, selects, and segmented toggles
  (e.g. `ChartControls`), built on the tokens above. Mobile-first picks: `Drawer`/`Sheet`
  for the bottom control bar and pickers, `ToggleGroup` for render mode, `Slider` for
  tempo, `Sonner` for small confirmations.
- **Make it fun.** The goal is a tool you want to open, not just one that works: color,
  small motion on progress moments (respecting `prefers-reduced-motion`), friendly empty
  states. It's a practice tool for one person, so it can have personality where a church
  admin tool couldn't.

- **Viewer** (`ArrangementViewer`, `ChartControls`): the toolbar is a wrapping top row with
  ~24px-tall inputs (`py-0.5`). Move it to a bottom bar, bring targets up to 44px, and
  collapse it while reading. The chart itself already reflows (`ChordLyricChart` is
  `flex-wrap` per chord cell, D-18), so wrapping at phone width should hold up. Verify on real
  devices.
- **Library/song pages**: list-first, search reachable from the bottom, no tables that need
  horizontal scroll.
- **Editor**: must be *usable* on a phone. Typing `[` `]` on a phone keyboard is painful, so
  add a chord-insert helper row above the keyboard (bracket plus common chords in the
  current key). A tap-a-syllable chord editor is a candidate in Later. Bulk editing and
  import can stay more comfortable on desktop; they don't have to be phone-optimal.
- **PWA manifest + icons**, standalone display mode.
- Test on real iOS Safari and Android Chrome, not just a narrow desktop window.

---

## Phase 1 · Practice mode in the viewer

The smallest step that makes this a practice tool rather than a chart library. It all sits
on the existing viewer. `tempo` and `time` are already parsed from ChordPro metadata
(`lib/chordpro/serialize.ts` `META_ORDER`), so there's no schema work to start.

- **Metronome** driven by the chart's `{tempo}`/`{time}`, with a tempo slider to practice
  slow and work up (Web Audio; schedule clicks ahead, don't `setInterval`). Mobile gotchas:
  iOS only starts audio after a user tap, and the ringer/silent switch can mute Web Audio.
  Add a visual beat indicator so the metronome is useful muted.
- **Autoscroll at tempo.** This was deferred as church "performance mode" because live songs
  don't run linearly. Practice is the case where it does work. Opt-in, pausable, speed-
  adjustable.
- **Loop a section**: pick a `{start_of_chorus}`/section, and the viewer (and the metronome
  count-in) stays on it.
- **Fit to one screen** / density control. This matters more on a phone, where most charts
  won't fit at a readable size. Also test a landscape two-column layout for phones on a
  stand.
- Foot-pedal page turn carries over unchanged (see below). It's just keyboard events.

### Decided (carried over) · Hands-free page turn

Per-player foot pedal, **DIY ESP32 + momentary foot switches over BLE HID keyboard
emulation** (decided 2026-09-18). The ESP32 pairs as a Bluetooth keyboard sending arrow/page
keys, so it rides on the viewer's existing navigation: near-zero app work. The church-context
alternatives (AV booth drives every viewer, tempo autoscroll as the mechanism) are recorded in
git history at `2f9b1e1` and no longer apply. **Pilot no longer waits on church iPads.** Test
on the phone the author practices with. BLE HID keyboards pair with iOS and Android the same
way; check that a paired "keyboard" doesn't suppress the on-screen keyboard in the editor.

---

## Phase 2 · Chord diagrams and tabs

What makes an Ultimate-Guitar-style chart useful for *learning* rather than just reading.

- **Chord diagrams**: a strip of fingering diagrams for every chord in the chart, from a
  built-in shape library, overridable per chart with ChordPro `{define}`. Diagrams must follow
  **capo** (show the shapes you finger, not the sounding chords; DOMAIN.md §4). Alternate
  voicings per chord. On a phone, a full strip eats the screen: show a horizontally
  scrolling strip, or tap a chord in the chart to pop its diagram.
- **Tab blocks**: ChordPro `{start_of_tab}`/`{end_of_tab}` rendered monospaced, in place
  within the chart. **v1 does not transpose tab**: a tab block is fixed fret numbers and
  renders unchanged when the key changes, with a visible notice. Fret-shifting tab (and
  retuning it across string sets) is possible later but is its own pure-module work with its
  own tests.
- **Tab is the hardest mobile problem.** A tab line is fixed-width (often 60–80 characters)
  and can't wrap without breaking alignment. Per tab block: horizontal scroll, or scale to
  fit width when the result stays legible. Landscape helps; don't require it.
- Neither needs D-04 revisited. D-04 rejected *OCR of notation from scans*; tabs and
  `{define}` are typed or imported text, which is ChordPro-native.
- Parser work first: `{define}` and tab sections aren't parsed yet.

---

## Phase 3 · Progress tracking

- **Per-song status**: want to learn → learning → learned → needs review.
- **Practice log**: date, minutes, tempo reached (the Phase 1 metronome makes this cheap to
  capture: "last session you got it to 84 of 120 bpm").
- **Encouragement, not guilt.** A practice calendar/heatmap and tempo-progress-per-song are
  the visible payoff that keeps you coming back. Celebrate "learned" and personal-best tempo.
  Skip punitive streak-loss mechanics.
- **Review queue**: learned songs you haven't touched in a while float back up. Keep it
  simple (a staleness sort), not a full spaced-repetition engine, unless that proves useful.
- **Your key and capo**: the per-player key choice D-02 put on `service_item` moves to the
  practice record. D-02's principle holds: key is never a property of `song`.
- **Practice notes** on an arrangement. D-20's planned `arrangement_note` (never built)
  reshaped for one player. "Part" becomes instrument ("Guitar", "Keys") rather than band
  seat, and the notes still stay typed, not freehand.
- No accounts needed while there's one user. If there are ever more, see the self-host lean
  above before adding auth.

---

## Phase 4 · Theory and learning aids

Builds on `lib/transpose`, which already knows keys, spelling, and Nashville numbers. New
logic goes in a pure module with its own tests, following the same rules as transposition.

- Roman-numeral / function labels on each chord in the key (I, IV, V, vi; borrowed ♭VII
  called out).
- **Capo suggestions**: "sounds in E♭ → capo 1, play D shapes" or "capo 3, play C shapes",
  ranked by open-shape friendliness.
- Voicing suggestions tied to the Phase 2 diagram library (easier/harder shapes for the same
  chord).
- Short "why this chord works here" explanations for common patterns.

---

## Later · Candidates, unranked

Worth doing once the phases above are in real use. Nothing here is committed.

- Reference-recording practice: link a YouTube/audio source you own or can legitimately
  access, loop and slow down a section alongside the chart. Links and local files only, no
  hosted audio (same rule as charts).
- Strumming / rhythm patterns attached to sections.
- Ear training built off your own library (play the progression, name the numbers).
- Offline cache of your library (IndexedDB / service worker, on top of the Phase 0 PWA).
  Mobile-first makes this likely rather than speculative. Move it up as soon as bad signal
  gets in the way of a practice session.
- Tap-a-syllable chord editor for phones (tap where the chord lands, pick from chords in the
  key), replacing bracket typing.
- Scan-alongside-chart for OCR'd personal charts (D-05). The church Drive design (D-10/D-21)
  is retired; personal scan storage is undecided.

---

## Pivot cleanup (do before new feature work)

- **Production data.** Prod (`worship-flow-hazel.vercel.app`) has no auth and serves the 6
  church charts imported 2026-09-18. Those are CCLI-licensed songs from the church's binders,
  so under "never host music for others" they should come off the public deployment (or the
  deployment should be locked down). The 5 demo hymns are public domain and can stay.
- **Services/setlists stay in the code for now, unmaintained.** They're built and working,
  but they aren't on this roadmap. Remove them in their own PR if they get in the way. Don't
  build on them.
- Naming (`worship-flow` / `worship-team`) no longer fits. Rename when it's convenient; it's
  not blocking.

---

## Non-goals

Do not build these. Each was considered and rejected.

- **Hosting music for others**: a public catalog, user-submitted tabs, shared song pages,
  or a bundled song library. Users bring their own charts (D-22).
- **Multi-tenancy, billing, signup flows**: one user today. If others come, self-hosting is
  the default answer.
- **Sheet music engraving / MusicXML rendering / OMR**: see D-04. Tabs and chord diagrams
  are text, not notation.
- **Services, setlists, scheduling, theme matching**: church features, retired with the
  pivot (see Archived).
- **Lyric projection; click tracks for live use; in-ear mixing; live audio sync.**
- **Automatic song-boundary detection** (D-09) and **a dedicated OCR review screen** (D-06):
  still true for the digitize script.

---

## Guiding constraint

The **bus factor** now mostly means *future you*. The rule still applies: boring and popular
over clever, managed hosting, and data that survives the app's death (`.pro` export).

The second risk is no longer adoption by a team. It's **whether you actually practice with
it**. Ship the smallest thing that gets opened before a practice session (Phase 1), use it
for real, and let that decide what comes next rather than building the whole list up front.

---

## Archived · Church-era phases

Retired 2026-09-28 with the pivot. The full text of each is in git history (`docs/ROADMAP.md`
at `2f9b1e1`). What's worth knowing without digging:

- **Services and setlists (was Phase 2)**: built (per-item key/capo, print/PDF, setlist
  viewer). Code remains; not maintained going forward.
- **Tablet viewer (was Phase 3)**: the viewer itself carried over (see Done). The
  church-bought iPads (D-17), setlist-wide offline cache, and part-scoped band notes (D-20)
  were church framing and are retired or reshaped above.
- **Theme matching (was Phase 4)** and **scheduling (was Phase 5)**: never started; dropped.
- **Bulk digitization (was Phase 1.5)**: the church's ~300-chart batch is cancelled. The
  20-chart pilot ran (12 songs / 17 pages, `test-001`); 6 charts went to prod (see Pivot
  cleanup). The Kyocera scanner and the church Google Drive scan storage (D-10, D-21) no
  longer apply. The script is kept for personal use. Its known extraction gaps, found on the
  real pilot batch, still stand for anyone OCR'ing their own paper:
  - **Mixed-layout two-column charts** (two columns for only part of a page) evade the
    multi-column detector in `scripts/digitize/lines.ts`. Needs more real samples before
    another tuning attempt; until then, reformat and re-scan or correct in-app.
  - **Adjacent content bleeding into a line** (margin pencil, a second column, a nearby
    chord-diagram or "TAG" box): warned on via `hasSuspiciousInternalGap`, never auto-
    stripped (stripping ate real content in fixtures). Check any chart the warning fires on
    against the scan.
  - **Title extraction can fail silently on a multi-column page**, falling back to the
    `Scanned <date>` placeholder.
