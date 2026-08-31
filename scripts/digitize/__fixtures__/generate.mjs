// Regenerate the golden-test fixtures. Each fixture is a positioned-word spec
// (chords and lyrics with x in character columns, y in pixel rows); this script
// turns it into a `<name>/words.tsv` in Tesseract's 12-column TSV shape.
//
//   node scripts/digitize/__fixtures__/generate.mjs
//
// The specs model clean OCR except `faded-photocopy`, which carries a couple of
// deliberate garbles. If you have `tesseract` + the `eng` traineddata installed
// and want TSV from a truly rendered image instead, that path is documented in
// scripts/digitize/README.md; the pipeline treats either identically.
//
// After regenerating, eyeball each words.tsv and update expected.pro /
// expected.warnings.json to match, then run `npm test`.

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const CHAR_W = 15; // px per monospace character column at the fixture's scale
const CHAR_H = 26;
const ORIGIN_X = 20;

const HEADER =
  "level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext";

/**
 * spec: array of rows. Each row = { y, chord?, words: [{ x, text, conf? }] }.
 * x is a character-column index. Lyric words start at column x; on a `chord`
 * row each token is centered over column x (how a typeset chart aligns a chord
 * to its syllable), so a wide chord like "G/B" doesn't drift right.
 */
function toTsv(rows) {
  const out = [HEADER];
  rows.forEach((row, li) => {
    row.words.forEach((wd, wi) => {
      const width = Math.max(wd.text.length * CHAR_W, CHAR_W);
      const left = row.chord
        ? Math.round(ORIGIN_X + (wd.x + 0.5) * CHAR_W - width / 2)
        : ORIGIN_X + Math.round(wd.x * CHAR_W);
      out.push(
        [
          5,
          1,
          1,
          1,
          li + 1,
          wi + 1,
          left,
          row.y,
          width,
          CHAR_H,
          wd.conf ?? 94,
          wd.text,
        ].join("\t"),
      );
    });
  });
  return out.join("\n") + "\n";
}

function write(name, rows) {
  mkdirSync(path.join(DIR, name), { recursive: true });
  writeFileSync(path.join(DIR, name, "words.tsv"), toTsv(rows));
  console.log(`${name}: ${rows.length} lines`);
}

const R = 46; // row pitch in px

// 1. clean-typeset — crisp, aligned, zero expected warnings.
write("clean-typeset", [
  { y: 40, words: [{ x: 0, text: "Amazing" }, { x: 8, text: "Grace" }] },
  { y: 40 + R, words: [{ x: 0, text: "Verse" }, { x: 6, text: "1" }] },
  {
    y: 40 + R * 2,
    chord: true, words: [
      { x: 0, text: "G" },
      { x: 8, text: "G/B" },
      { x: 14, text: "C" },
      { x: 28, text: "G" },
    ],
  },
  {
    y: 40 + R * 3,
    words: [
      { x: 0, text: "Amazing" },
      { x: 8, text: "grace" },
      { x: 14, text: "how" },
      { x: 18, text: "sweet" },
      { x: 24, text: "the" },
      { x: 28, text: "sound" },
    ],
  },
  { y: 40 + R * 4, chord: true, words: [{ x: 0, text: "D" }, { x: 12, text: "G" }] },
  {
    y: 40 + R * 5,
    words: [
      { x: 0, text: "That" },
      { x: 5, text: "saved" },
      { x: 11, text: "a" },
      { x: 13, text: "wretch" },
      { x: 20, text: "like" },
      { x: 25, text: "me" },
    ],
  },
]);

// 2. faded-photocopy — an unparseable token ("D5o") and an out-of-key chord
//    ("Eb" in D), both low-confidence, plus one dropped lyric word.
write("faded-photocopy", [
  { y: 40, words: [{ x: 0, text: "How" }, { x: 4, text: "Great" }, { x: 10, text: "Thou" }, { x: 15, text: "Art" }] },
  { y: 40 + R, words: [{ x: 0, text: "Verse" }, { x: 6, text: "1" }] },
  {
    y: 40 + R * 2,
    chord: true, words: [
      { x: 0, text: "D", conf: 71 },
      { x: 10, text: "D5o", conf: 38 },
      { x: 18, text: "D", conf: 66 },
    ],
  },
  {
    y: 40 + R * 3,
    words: [
      { x: 0, text: "O" },
      { x: 2, text: "Lord" },
      { x: 7, text: "my" },
      { x: 10, text: "God" },
      { x: 14, text: "when" },
      { x: 19, text: "in" },
      { x: 22, text: "awesome" },
      { x: 30, text: "wonder" },
    ],
  },
  {
    y: 40 + R * 4,
    chord: true, words: [
      { x: 0, text: "A", conf: 63 },
      { x: 13, text: "Eb", conf: 41 },
    ],
  },
  {
    y: 40 + R * 5,
    words: [
      { x: 0, text: "Consider" },
      { x: 9, text: "all" },
      { x: 13, text: "the" },
      { x: 17, text: "worlds" },
      { x: 30, text: "hands" },
      { x: 36, text: "have" },
      { x: 41, text: "made" },
    ],
  },
]);

// 3. instrumental-stacked — Intro comment, a bar-line instrumental row, and two
//    stacked chord lines over one lyric.
write("instrumental-stacked", [
  { y: 40, words: [{ x: 0, text: "Holy" }, { x: 5, text: "Holy" }, { x: 10, text: "Holy" }] },
  { y: 40 + R, words: [{ x: 0, text: "Intro" }] },
  {
    y: 40 + R * 2,
    chord: true, words: [
      { x: 0, text: "|" },
      { x: 2, text: "G" },
      { x: 4, text: "|" },
      { x: 6, text: "C" },
      { x: 8, text: "|" },
      { x: 10, text: "G" },
      { x: 12, text: "|" },
      { x: 14, text: "D" },
      { x: 16, text: "|" },
    ],
  },
  { y: 40 + R * 3, words: [{ x: 0, text: "Verse" }] },
  { y: 40 + R * 4, chord: true, words: [{ x: 0, text: "D" }, { x: 12, text: "A" }] },
  { y: 40 + R * 5, chord: true, words: [{ x: 0, text: "Bm" }, { x: 8, text: "G" }] },
  {
    y: 40 + R * 6,
    words: [
      { x: 0, text: "Holy" },
      { x: 5, text: "holy" },
      { x: 10, text: "holy" },
      { x: 15, text: "Lord" },
      { x: 20, text: "God" },
      { x: 24, text: "almighty" },
    ],
  },
]);

// 4. minor-no-printed-key — minor chart, no printed key; exercises first-chord.
write("minor-no-printed-key", [
  { y: 40, words: [{ x: 0, text: "Come" }, { x: 5, text: "Thou" }, { x: 10, text: "Fount" }] },
  { y: 40 + R, words: [{ x: 0, text: "Verse" }, { x: 6, text: "1" }] },
  { y: 40 + R * 2, chord: true, words: [{ x: 0, text: "Em" }, { x: 12, text: "C" }] },
  {
    y: 40 + R * 3,
    words: [
      { x: 0, text: "Come" },
      { x: 5, text: "thou" },
      { x: 10, text: "fount" },
      { x: 16, text: "of" },
      { x: 19, text: "every" },
      { x: 25, text: "blessing" },
    ],
  },
  { y: 40 + R * 4, chord: true, words: [{ x: 0, text: "G" }, { x: 14, text: "D" }] },
  {
    y: 40 + R * 5,
    words: [
      { x: 0, text: "Tune" },
      { x: 5, text: "my" },
      { x: 8, text: "heart" },
      { x: 14, text: "to" },
      { x: 17, text: "sing" },
      { x: 22, text: "thy" },
      { x: 26, text: "grace" },
    ],
  },
]);

console.log("done — update expected.pro / expected.warnings.json per fixture");
