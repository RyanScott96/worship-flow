# Roadmap

Build in this order. Each phase is independently useful — if the project stalls after any
one of them, what exists is still worth having.

---

## Phase 1 · Song library and transposition

**Start here. Nothing else works without it.**

- ChordPro parser and renderer.
- **Transposition module** — pure, no I/O, no framework imports, heaviest test suite in the
  repo. Read `docs/DOMAIN.md` §3 before writing a line of it. The enharmonic spelling table
  is the part that gets done wrong.
- Song/arrangement CRUD, ChordPro editor with live preview.
- Render modes off one source: chords+lyrics, lyrics only, Nashville numbers.
- Import from ChordPro / plain text.
- Export every arrangement as `.pro` files.

**Build the export button in week one.** It's the bus-factor insurance: if this project is
abandoned in two years, the church still has a folder of files that open in OnSong or
SongBook. That single feature makes the whole project safe to attempt.

---

## Phase 1.5 · Digitization (~300 charts, one time)

Runs as a local TypeScript/Node script (`scripts/digitize/`, run via `npm run
digitize`), not part of the app (D-08). It reuses the app's tested
`lib/chordpro` / `lib/transpose` rather than reimplementing chord/key logic.

1. **Pilot 20 charts first.** Check DPI is adequate on the worst photocopies and that the
   splitter behaves, before committing to hardware or scanning 600 pages.
2. Scan: 300 dpi **grayscale** (not bitonal — preserves pencil annotations; not color — 3×
   the size for zero OCR benefit).
3. Split the batch PDF into songs: `npm run digitize split` — the thumbnail-click tool (D-09).
4. Extract to ChordPro via bounding-box OCR (Tesseract + geometry — see DOMAIN.md §7, D-16).
5. Run validators; write `extraction_warnings`.
6. Import everything as `unverified`. Ship it. Correction happens in-app (D-06).

Pipeline the work: scan one binder while extraction runs on the previous one. Scanning is the
bottleneck (~4–6 hours of human time); extraction is ~30 minutes unattended.

**Known gap: mixed-layout two-column charts.** The multi-column detector (`scripts/digitize/
lines.ts`) catches a chart that's two columns for its whole page, but missed one in the
12-song/17-page pilot batch that was two-column only in its top verse block, with the
chorus/bridge below it back to single-column full width — the mixed layout dilutes both
detection heuristics below their thresholds. A same-page-different-region signal to catch
this reliably wasn't findable without real risk of reintroducing false positives on two other
pilot charts whose OCR noise (handwriting bleed, diagram bleed) already mimics a column seam.
Needs more real two-column samples — ideally more of this specific "columns for only part of
the page" shape — before another attempt at tuning it. Until then this class of chart needs a
manual re-scan (reformatted to single column) or in-app correction against the retained scan,
same as any other extraction miss (D-06).

**Known gap: handwriting/annotation bleed still corrupts a chart — no longer silently.**
Pencil margin notes (capo reminders, pitch-pipe doodles, "skip last time") sitting near a
chord/lyric line can get geometrically grouped into it — Tesseract's own line/paragraph
segmentation fuses them at OCR time, upstream of anything this pipeline's own line-grouping
does — splicing garbage words into the lyric stream. Real `test-001` pilot case: "Great
Things" came out with junk tokens interleaved into real lyrics, mean OCR confidence well
above the re-scan floor because the individual characters read cleanly.

Fixed the "silent" part: `lines.ts` `hasSuspiciousInternalGap` flags a line whose own word
gaps contain a jump far bigger than the rest of that line's spacing, surfaced as an
`extraction_warning` note ("N line(s) have an unusually large internal word gap..."). An
earlier attempt at this session actually *stripping* the flagged words, not just warning,
silently ate real content in two of this repo's own fixtures instead (a justified-text lyric
line's one wider-than-usual legitimate gap, and a chord-diagram row's uneven internal
spacing) — a word gap alone can't reliably tell "annotation bleed" from "a real line with
uneven spacing," so correction stays manual (D-06: against the scan, not silently in the
pipeline) and this only ever warns. Still true: check any chart the warning fires on against
the scan before trusting it, especially one with dense margin handwriting.

**Known gap: title extraction can fail silently on a multi-column page.** The title band (lines
above the first chord/section line on page 1) is read in geometric top-to-bottom order; on a
genuinely two-column chart, a structural line in one column (e.g. "Intro:") can sort ahead of a
boxed title sitting in the other column, so the title band never sees the title and the chart
falls back to the `Scanned <date>` placeholder — real `test-001` pilot case: "Never Get's Old"
(Red Rocks Worship). That chart was already correctly flagged RE-SCAN CANDIDATE on OCR
confidence (69.3), so the practical impact there was low, but a multi-column chart that
otherwise scans at high confidence could still lose its title with no warning calling that out
specifically.

**Scanner:** the church's Kyocera TASKalfa MZ250lci. Confirmed 2026-09-18: it scans to folder
at 300 dpi grayscale, and it's fast enough that there's no real case for pushing DPI higher.
Committed to for the full ~300-chart batch.

**Where the scans live:** the church's Google Drive, in the shared "Band Music & Lyrics"
folder — editor access confirmed 2026-09-18 (D-10). The scans belong where the volunteers
already look, not on a rack nobody wants to own. Flat layout, one PDF per song; upload is
manual; the app captures each file's share link at import time rather than resolving a path
at runtime (D-21). Still unbuilt: the link-capture step and the in-app scan viewer — see
`docs/DIGITIZATION.md` § Storage. The app still stores only text and relational data on Neon.

---

## Phase 2 · Services and setlists

- Create a service, drag arrangements into order.
- Per-item key and capo (this is the whole point — D-02).
- Non-song items: welcome, prayer, sermon.
- Print/PDF export of the full set.
- **Verification badge visible in the setlist builder** (D-07).
- Compare-to-scan: original key listed alongside the transposed key, tap to switch, tap back.

---

## Phase 3 · On-screen chart viewer (tablet)

Funded and expected. On 2026-09-01 the pastor offered to buy the worship team iPads to read
charts in the app — conditional on the viewer being genuinely better than a page in a binder.
That condition is the spec: it has to earn the tablets. The PDF export in the right key stays
the low-tech fallback for anyone who never picks up a screen.

There is no single-arrangement on-screen viewer yet — the arrangement page only renders the
editor. Build one:

- Tablet-first: large type, generous spacing, readable at music-stand distance in a lit room;
  dark theme for a dim stage.
- Per-view key and capo controls (reuse `lib/transpose`; the setlist key is the default), and
  the render-mode switch off one source (chords+lyrics / lyrics / Nashville) the editor
  already has.
- **Chords above the lyrics** in chords+lyrics mode, not inline `[ ]` brackets — each chord
  sits over the syllable it lands on (lead-sheet layout, D-18). Reflow-friendly so lines wrap
  without losing alignment, and it has to hold up in the setlist print/PDF path too. Replaces
  the inline-bracket `<pre>` that `ChordProPreviewPane` / `ServiceSongChart` render today.
- Scan one tap away (D-05); verification badge visible (D-07).
- Offline cache (IndexedDB) of the current setlist's charts **and** scans, so church Wi-Fi
  isn't a Sunday-morning dependency.
- Arrow-key and tap-zone page navigation; keep the screen awake (Wake Lock API).
- No login wall between opening the app and seeing a setlist (auth is still out of scope).

Fullscreen "performance mode" polish (auto-scroll, set-wide swipe) can follow once the basic
viewer is in real use on a stand.

### Decided (mechanism) · Advancing the chart hands-free, live

The team's blocker with paper is turning the page mid-song with both hands busy.

- **Foot pedal, per musician, independent** — the guitarist and the keys player are never
  on the same bar at the same moment, so a shared/driven mechanism is the wrong model.
  **Chosen over:**
  - **AV booth drives every viewer.** No per-musician hardware, one place to manage — but it
    forces the whole band onto the same page at once (they don't read in unison), adds a live
    task to an already-loaded AV role, and needs a realtime sync channel: new infrastructure,
    a new failure mode, and it works against the offline-cache goal. Left as an *optional*
    follow-the-leader mode for later, not the mechanism.
  - **Tempo-based autoscroll.** No hardware, no operator — but songs don't run linearly
    against wall-clock (repeats, vamps, held endings, an audible from the leader), so you
    fight the scroll all song, and the charts are short enough that the payoff is small.
    Stays in the deferred "performance mode" bucket as an opt-in toggle at most.
- **Hardware: DIY, ESP32 + momentary foot switches**, not a bought pedal (AirTurn/PageFlip/
  Coda), decided 2026-09-18. **Protocol: BLE HID keyboard emulation** — the ESP32 pairs as a
  Bluetooth keyboard emitting arrow/page keys, the same mechanism a bought pedal would use,
  so it rides on the nav the viewer already has: still near-zero app work, just confirming
  keycodes and Wake Lock. Works offline. Trades the ~$60–120/unit commercial cost and
  per-vendor pairing quirks for build time and one more thing the team maintains itself.

**Pilot still pending** on tablet hardware: test the built pedal against the current viewer
on an actual iPad on a stand — does it hold across a full song, does the screen stay awake,
how bad is pairing for a volunteer. Measure alongside it what fraction of real charts
(post-digitization) actually overflow one screen at a readable size: if that's small, a
density / "fit to one page" control removes most page turns for everyone and shrinks the
whole question. Write up what the pilot shows as a `docs/DECISIONS.md` entry — the mechanism
and hardware choice above are decided, but the pilot could still surface a reason to fall
back (e.g. BLE HID reliability issues specific to the ESP32 build).

### Planned · Part-scoped notes on a chart

The band writes on paper charts today — most concretely, the pianist works out a melodic line
and wants it recorded to reference next time. Bring that in as **typed notes**, scoped to a
**part** ("Keys", "Guitar 1") rather than a person: there's no accounts system to hang them
on, and the part outlives whoever plays it this month. Freehand "writing on" the chart is out
— the leader accepted typed notes.

- A note is `{ part, body, optional location hint }` on an **arrangement** (D-03 grain — the
  viewers already work at that level). New `arrangement_note` table, `on delete cascade`; no
  revision log (additive scratch, unlike the canonical chart under D-06).
- `part` is free text with a datalist of common values, so "Guitar 2" / "Mandolin" never
  need a code change.
- **v1 surfaces:** full add/edit/delete on the arrangement editor page; a read-only,
  collapsible, part-filtered panel in the single-arrangement viewer (musician picks their
  part once, remembered per device).
- **Deferred:** the setlist/live viewer (held back on purpose — an extra panel is riskiest
  there), print/PDF inclusion, a "N notes" hint on the song page.

See D-20.

---

## Phase 4 · Theme matching

Ahead of scheduling — this is a real pain, scheduling is a group text (D-15).

Requires a populated library and some rotation history first, or it suggests songs nobody
knows.

**Build the live version first:** a text box at Wednesday practice. Leader types
"Psalm 23, anxiety and provision", gets candidates in five seconds. Zero dependency on anyone
changing their workflow, so it always works. Async ingestion (emailed sermon notes, watched
doc) is a pure optimization layered on the same engine.

**Cheap validity check before building any UI:** enrich 30 songs, embed, hand-write five
realistic sermon themes, eyeball the top five results. Show them to whoever picks songs now.
This feature either feels uncanny or feels useless, with little in between — find out in an
hour, not a weekend.

Ingestion is a thin adapter over one internal shape:
`{ date, title, scripture_refs[], body_text }`. Build the plain textarea first; it's the
permanent fallback for guest speakers and vacation weeks.

**Answered 2026-09-18:** no rigid preaching calendar. Pastor Jeremy plans in sermon
*series*, known 1–2 months out; the individual sermon itself is finalized Sunday morning,
but a general idea exists from the start and the outline is ready by Wednesday practice.
That kills the "one paste per quarter" async-ingestion case — there's no stable passage to
paste ahead of time. It also confirms the live version is the right (and probably
sufficient) design: Wednesday practice is exactly when an outline first exists, so a text
box at practice catches the theme at the earliest moment it could be used. The series name,
known months ahead, could still seed a coarse filter later, but isn't worth building before
the validity check above.

---

## Phase 5 · Scheduling

Only if requested. Assignments, availability, ICS feed, reminder emails.

---

## Non-goals

Do not build these. Each was considered and rejected.

- **Lyric projection** — that's ProPresenter's job and a separate product.
- **Sheet music engraving / MusicXML rendering** — see D-04.
- **Click tracks, in-ear mixing, live audio sync.**
- **Multi-tenancy, billing, signup flows** — one church, 12 users, forever.
- **A bundled song library** — content is CCLI-licensed per church; they import their own.
- **Automatic song-boundary detection** — see D-09.
- **A dedicated OCR review screen** — see D-06.

---

## Guiding constraint

The real risk is not scale, it's the **bus factor**. In three years the author may have moved
on. That argues for boring and popular over clever, managed hosting so nobody inherits a
server to patch, and data that survives the app's death.

Second risk is **adoption**. If four people use the app and eight keep using binders, there
are now two sources of truth — worse than the paper you started with. Ship fewer features
that work perfectly rather than more that mostly work. The tablet viewer (Phase 3) is the
adoption lever: church-bought iPads and a viewer worth using are what keep the team from
splitting between the app and the binders.
