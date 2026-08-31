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
3. Split the batch PDF into songs via the thumbnail-click tool (D-09).
4. Extract to ChordPro via bounding-box OCR (Tesseract + geometry — see DOMAIN.md §7, D-16).
5. Run validators; write `extraction_warnings`.
6. Import everything as `unverified`. Ship it. Correction happens in-app (D-06).

Pipeline the work: scan one binder while extraction runs on the previous one. Scanning is the
bottleneck (~4–6 hours of human time); extraction is ~30 minutes unattended.

**Scanner:** the church's Kyocera TASKalfa MZ250lci — confirm during the pilot that it can
scan-to-folder at 300 dpi grayscale before committing to it for the full batch.

---

## Phase 2 · Services and setlists

- Create a service, drag arrangements into order.
- Per-item key and capo (this is the whole point — D-02).
- Non-song items: welcome, prayer, sermon.
- Print/PDF export of the full set.
- **Verification badge visible in the setlist builder** (D-07).
- Compare-to-scan: original key listed alongside the transposed key, tap to switch, tap back.

---

## Phase 3 · Stage mode

Only if the team asks. A low-tech church is already comfortable with paper, and a PDF export
in the right key delivers most of the value. Let them request screens.

If built: fullscreen dark viewer, large type, offline cache (IndexedDB), arrow-key/pedal
navigation. Cache the current setlist's scans so the rack isn't a Sunday-morning dependency.

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

**Worth asking the user:** does the church keep a preaching calendar planned by passage?
If so that's months of lead time from one paste per quarter, instead of hours.

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
that work perfectly rather than more that mostly work.
