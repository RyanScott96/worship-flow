# Domain reference

Music-specific knowledge required to work on this codebase. A general coding assistant will
get the enharmonic spelling wrong if it skips this file.

---

## 1. ChordPro

Canonical storage format. Chords inline in square brackets, positioned immediately before the
syllable they land on. Metadata in braces.

```
{title: Amazing Grace}
{key: G}
{tempo: 72}

{start_of_verse: Verse 1}
[G]Amazing [G/B]grace, how [C]sweet the [G]sound
That [G]saved a [Em]wretch like [D]me
{end_of_verse}

{start_of_chorus}
[C]Praise the [G]Lord
{end_of_chorus}
```

Directives used: `title`, `subtitle`, `key`, `tempo`, `time`, `capo`, `comment` (`c`),
`start_of_verse`/`end_of_verse` (`sov`/`eov`), `start_of_chorus`/`end_of_chorus`
(`soc`/`eoc`), `start_of_bridge`/`end_of_bridge`. Accept the short aliases on parse; always
emit the long form.

**Only text inside `[...]` is a chord.** Never transpose lyric text. A capital letter in
lyrics is not a chord.

### Why ChordPro and not something else

One source renders four ways — chords+lyrics (guitar), lyrics only (vocals), Nashville
numbers (keys), chords only (rhythm section). Transposition is a pure string operation.
PDFs cannot be transposed at all. See DECISIONS.md D-01.

---

## 2. Chord grammar

```
root  = [A-G] + optional accidental (# or b)
qual  = m, min, maj, dim, aug, sus2, sus4, add9, 6, 7, maj7, 9, 11, 13, +, °, ø,
        and alterations like #5, b9, #11
bass  = optional "/" + note (same shape as root)
```

Parse regex (anchored, non-greedy quality):

```
/^([A-G][#b]?)(.*?)(?:\/([A-G][#b]?))?$/
```

Examples that must parse: `G`, `Am`, `C/E`, `F#m7`, `Bbmaj7#11/D`, `Asus4`, `Dm7b5`, `G°`.

**Transpose the root and the bass. Leave the quality string byte-identical.** This is the
single most common bug: shifting `Am` to `Bm` must not touch the `m`.

A token that fails this regex is an extraction error, not a chord. Flag it; do not guess.

---

## 3. Transposition and enharmonic spelling

### The naive version is wrong

Mapping notes to pitch classes 0–11 and adding a delta produces musically valid but
**incorrectly spelled** results: `E#`, `Cb`, `Fb`, or `A#` where the chart should read `Bb`.
Musicians notice immediately and lose trust in the tool.

Transposition is two steps:

1. **Shift the pitch class.** `delta = (pc(targetKey) - pc(sourceKey) + 12) % 12`
2. **Spell the result according to the target key.**

### Spelling rule

Keys are either sharp keys or flat keys, per the circle of fifths:

- **Sharp keys:** G, D, A, E, B, F#, C#
- **Flat keys:** F, Bb, Eb, Ab, Db, Gb
- **C** has no accidentals; treat as sharp-leaning by convention.

For each key, build a 12-slot lookup of pitch class → note name:

- **Diatonic notes** get the spelling from that key's signature. In Eb major, pitch class 3
  is `Eb`, never `D#`.
- **Chromatic notes** follow the key's direction: sharps in sharp keys, flats in flat keys.

Implement as a static 12-entry table per key. There are ~15 usable major keys, so this is a
hand-verifiable constant, not an algorithm to derive at runtime. Minor keys use their
relative major's table (Am → C, Em → G, Cm → Eb).

### Test cases that must pass

| From | To | Input | Correct | Wrong (naive) |
|---|---|---|---|---|
| C | Db | `F` | `Gb` | `F#` |
| C | D | `F` | `G` | — |
| A | Bb | `A` | `Bb` | `A#` |
| G | Ab | `B` | `C` | `B#` |
| C | B | `F` | `E` | `E#` |
| Eb | E | `Ab` | `A` | `G##` |
| C | F# | `C` | `F#` | `Gb` |

Also assert: quality strings survive unchanged; slash bass transposes with the root;
`[G/B]` → in D: `[D/F#]`.

---

## 4. Capo

Capo raises pitch. A guitarist fingering G shapes with capo 3 sounds in Bb.

```
displayedChord = soundingKey - capoFret   (semitones)
```

So a chart sounding in Bb with capo 3 displays G shapes. Always show both in the UI:
"Capo 3 · play in G · sounds in Bb". A guitarist seeing only one of those numbers will play
in the wrong key.

Capo is stored on `service_item`, not on the song — it's a per-player, per-service choice.

---

## 5. Nashville numbers

Keys players often prefer scale degrees over letters. Derived, never stored.

| Degree | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|
| Major key | I | ii | iii | IV | V | vi | vii° |

Two notations in use: roman (`I ii IV V`) and Nashville proper (`1 2- 4 5`, minus for minor).
Support roman first; it's more widely read.

---

## 6. Editing a chart while viewing it transposed

**Trap:** a user views a chart in F, fixes a wrong chord, and the app saves. The arrangement
is canonically stored in A. The edit must be transposed back to A before persisting, or the
stored chart becomes a mix of two keys.

**Round-tripping is not perfectly lossless.** A chromatic chord can come back differently
spelled, because non-diatonic spelling is genuinely ambiguous. Nothing breaks musically, but
the chart drifts a little on every edit in a foreign key.

**Solution: save diffs, not documents.** Persist only the chord tokens that actually changed,
transposed back to canonical. Every untouched chord stays byte-identical to what the
extractor produced.

Required test: edit one chord while viewing in a transposed key, assert every other byte of
the stored ChordPro is unchanged.

---

## 7. OCR: chord-line vs lyric-line

For the digitization pipeline (see ROADMAP Phase 1.5), extraction uses bounding-box OCR
(Tesseract + geometry, not a VLM — see D-16):

1. Classify each text line: if most tokens parse as chords, it's a chord line.
2. Pair each chord line with the lyric line directly beneath it.
3. For each chord token, take its **x-center**, find which character in the lyric line
   occupies that x-range, and splice `[Chord]` in at that index.

Step 3 is the whole trick. Flattened OCR text destroys horizontal alignment, and horizontal
alignment *is* the information — it's what says the chord lands on "grace" and not "sweet."
Never work from flattened text.

### Validators (cheap, local, run on every extraction)

- Every chord token parses under the grammar above.
- Detect the key; flag chords not diatonic to it as possible misreads.
- Sanity-check the ratio of chord lines to lyric lines.
- Assert page count per song matches what the splitter expected — catches silent scanner
  double-feeds, which otherwise produce a chart quietly missing a verse.

---

## 8. CCLI

Churches license worship music through CCLI, and the license generally requires reporting
which songs were used. Since `times_played` is already tracked off the setlist join,
generating that report is nearly free and replaces a manual chore.

`song.ccli_number` exists for this. Do not build a bundled song library — content is licensed
per church and must be imported by them.
