import { describe, expect, it } from "vitest";
import { classifyLine, countTokens, isChordish, SECTION_LABEL_RE } from "./classify";
import type { OcrLine, OcrWord } from "./types";

/** Build a bare OcrLine from a plain string — only `text` matters for classify. */
function line(text: string, over: Partial<OcrLine> = {}): OcrLine {
  const words: OcrWord[] = text.split(/\s+/).filter(Boolean).map((t, i) => ({
    page: 1,
    block: 1,
    par: 1,
    line: 1,
    word: i,
    left: i * 100,
    top: 0,
    width: 80,
    height: 20,
    conf: 90,
    text: t,
  }));
  return {
    key: "1.1.1",
    words,
    xLeft: 0,
    xRight: words.length * 100,
    yTop: 0,
    yBottom: 20,
    yMid: 10,
    height: 20,
    text,
    meanConf: 90,
    ...over,
  };
}

describe("isChordish", () => {
  it("accepts real chords across the grammar", () => {
    for (const c of ["G", "Am", "C/E", "F#m7", "Bbmaj7#11/D", "Asus4", "Dm7b5", "G°", "A"]) {
      expect(isChordish(c), c).toBe(true);
    }
  });

  it("rejects lyric words that start with a note letter", () => {
    for (const w of ["Add", "Every", "Bass", "Grace", "Down", "Free", "Come", "Be", "All"]) {
      expect(isChordish(w), w).toBe(false);
    }
  });

  it("strips wrapping punctuation", () => {
    expect(isChordish("(Em)")).toBe(true);
    expect(isChordish("G7,")).toBe(true);
    expect(isChordish("D.")).toBe(true);
  });

  it("rejects absurdly long tokens", () => {
    expect(isChordish("Gsomethingunreasonable")).toBe(false);
  });
});

describe("classifyLine", () => {
  it("a row of only chords is a chord line", () => {
    expect(classifyLine(line("G  C  D  Em"))).toBe("chord");
  });

  it("an instrumental bar line is a chord line", () => {
    expect(classifyLine(line("| G | C | %"))).toBe("chord");
    expect(classifyLine(line("D  A  x2"))).toBe("chord");
  });

  it("a lyric line with one leading chord-ish word is still lyric", () => {
    expect(classifyLine(line("A Mighty Fortress Is Our God"))).toBe("lyric");
    expect(classifyLine(line("Amazing grace how sweet the sound"))).toBe("lyric");
  });

  it("section labels", () => {
    for (const s of ["Verse 1", "CHORUS", "Bridge", "Pre-Chorus:", "2. Verse", "Intro"]) {
      expect(classifyLine(line(s)), s).toBe("section");
    }
  });

  it("a blank line", () => {
    expect(classifyLine(line(""))).toBe("blank");
  });

  it("N.C. is neutral, not a lyric word", () => {
    const c = countTokens(line("N.C. G C"));
    expect(c).toEqual({ nChord: 2, nWord: 0 });
  });
});

describe("SECTION_LABEL_RE", () => {
  it("does not match a chord line or a lyric line", () => {
    expect(SECTION_LABEL_RE.test("G C D")).toBe(false);
    expect(SECTION_LABEL_RE.test("Amazing grace")).toBe(false);
  });
});
