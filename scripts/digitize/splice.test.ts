import { describe, expect, it } from "vitest";
import { spliceChordsIntoLyric } from "./splice";
import type { OcrLine, OcrWord } from "./types";

let seq = 0;
function w(text: string, left: number, width: number): OcrWord {
  return {
    page: 1,
    block: 1,
    par: 1,
    line: 1,
    word: seq++,
    left,
    top: 0,
    width,
    height: 20,
    conf: 90,
    text,
  };
}

function asLine(words: OcrWord[]): OcrLine {
  const xLeft = Math.min(...words.map((x) => x.left));
  const xRight = Math.max(...words.map((x) => x.left + x.width));
  return {
    key: "1.1.1",
    words: [...words].sort((a, b) => a.left - b.left),
    xLeft,
    xRight,
    yTop: 0,
    yBottom: 20,
    yMid: 10,
    height: 20,
    text: words.map((x) => x.text).join(" "),
    meanConf: 90,
  };
}

// Lyric "Amazing grace": 20px per char. "Amazing" [0,140], space [140,160],
// "grace" [160,260].
const lyric = asLine([w("Amazing", 0, 140), w("grace", 160, 100)]);
/** x-center a chord word needs to sit over character index `i` of the lyric. */
function overChar(i: number): number {
  return i * 20 + 10;
}

describe("spliceChordsIntoLyric", () => {
  it("places a chord exactly over its syllable", () => {
    const chords = asLine([w("G", overChar(0) - 10, 20), w("C", overChar(8) - 10, 20)]);
    expect(spliceChordsIntoLyric(chords, lyric).text).toBe("[G]Amazing [C]grace");
  });

  it("a chord in the inter-word gap attaches to the following word", () => {
    const chords = asLine([w("C", 150 - 10, 20)]); // centre 150 = middle of the space
    expect(spliceChordsIntoLyric(chords, lyric).text).toBe("Amazing [C]grace");
  });

  it("a chord left of the first character clamps to index 0", () => {
    const chords = asLine([w("G", -60, 20)]);
    expect(spliceChordsIntoLyric(chords, lyric).text).toBe("[G]Amazing grace");
  });

  it("a chord past the last character clamps to the end", () => {
    const chords = asLine([w("D", 400, 20)]);
    expect(spliceChordsIntoLyric(chords, lyric).text).toBe("Amazing grace[D]");
  });

  it("two chords resolving to the same index keep source order", () => {
    const chords = asLine([w("C", overChar(0) - 10, 20), w("G", overChar(0) - 8, 20)]);
    expect(spliceChordsIntoLyric(chords, lyric).text).toBe("[C][G]Amazing grace");
  });

  it("an instrumental line with no lyric emits chords back to back", () => {
    const chords = asLine([w("C", 0, 20), w("G", 100, 20), w("Am", 200, 30)]);
    expect(spliceChordsIntoLyric(chords, null).text).toBe("[C][G][Am]");
  });

  it("keeps bar lines as literal text on an instrumental line", () => {
    const chords = asLine([w("|", 0, 6), w("G", 20, 20), w("|", 60, 6), w("C", 80, 20), w("%", 120, 10)]);
    expect(spliceChordsIntoLyric(chords, null).text).toBe("| [G] | [C] %");
  });

  it("keeps a non-parsing token in the line but reports it", () => {
    const chords = asLine([w("G", overChar(0), 20), w("Xyz", overChar(4), 20)]);
    const r = spliceChordsIntoLyric(chords, lyric);
    expect(r.nonChordTokens).toEqual(["Xyz"]);
    expect(r.text).toContain("[Xyz]");
  });

  it("snaps a near-miss to the start of the word it belongs to", () => {
    // "grace" rendered narrower than 5*20: chord aimed a char or two into it.
    const narrow = asLine([w("Amazing", 0, 140), w("grace", 160, 84)]);
    const chords = asLine([w("C", 160 + Math.round(1.5 * (84 / 5)), 20)]);
    expect(spliceChordsIntoLyric(chords, narrow).text).toBe("Amazing [C]grace");
  });

  it("leaves a genuinely mid-word chord alone (melisma, >2 chars in)", () => {
    // one long word, chord aimed at its middle
    const line = asLine([w("hallelujah", 0, 300)]);
    const chords = asLine([w("D", 150 - 10, 20)]); // centre ~150 -> ~char 5
    const out = spliceChordsIntoLyric(chords, line).text;
    expect(out).toMatch(/^hall?e?l?[[]D]/); // inside the word, not snapped to 0
    expect(out.startsWith("[D]")).toBe(false);
  });
});
