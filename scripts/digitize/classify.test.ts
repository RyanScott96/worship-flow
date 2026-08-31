import { describe, expect, it } from "vitest";
import {
  classifyLine,
  countTokens,
  fixChordOcr,
  fixLyricWord,
  isChordish,
  isJunkLine,
  isNeutralToken,
  normalizeChordToken,
  SECTION_LABEL_RE,
} from "./classify";
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

describe("real-chart OCR handling", () => {
  it("treats (2) / (hold) duration markers as neutral", () => {
    for (const t of ["(2)", "(3)", "(hold)", "2", "hold"]) {
      expect(isNeutralToken(t), t).toBe(true);
    }
    // "D (2) G D" is a chord line, not a lyric line
    expect(classifyLine(line("D (2) G D"))).toBe("chord");
    expect(countTokens(line("A7 (2)"))).toEqual({ nChord: 1, nWord: 0 });
  });

  it("strips a glued-on duration marker from a chord token", () => {
    expect(normalizeChordToken("D(2")).toBe("D");
    expect(normalizeChordToken("A7(2)")).toBe("A7");
  });

  it("repairs the 7->T and leading-O chord OCR confusions", () => {
    expect(fixChordOcr("AT")).toBe("A7");
    expect(fixChordOcr("ET")).toBe("E7");
    expect(fixChordOcr("OD")).toBe("D");
    expect(isChordish("AT")).toBe(true);
  });

  it("drops fret-diagram, fret-number and strum-pattern rows", () => {
    expect(isJunkLine(line("132 21 3 12"))).toBe(true);
    expect(isJunkLine(line("D xx0232 G 320003 A7 x02020"))).toBe(true);
    expect(isJunkLine(line("Strum Pattern"))).toBe(true);
    expect(isJunkLine(line("1 + 2 + 3 +"))).toBe(true);
    // strum notation, even with chord-letter marks or OCR-merged tokens
    expect(isJunkLine(line("d Dd D"))).toBe(true);
    expect(isJunkLine(line("d   D d       D"))).toBe(true);
    expect(isJunkLine(line("D U D U"))).toBe(true);
    expect(isJunkLine(line("B du B d ou"))).toBe(true); // bass-strum, OCR-merged
    expect(isJunkLine(line("x x x x"))).toBe(true);
    // a real chord row is NOT junk
    expect(isJunkLine(line("D D D"))).toBe(false);
    expect(isJunkLine(line("G C D"))).toBe(false);
    expect(isJunkLine(line("B A G"))).toBe(false);
    expect(isJunkLine(line("Em C G D"))).toBe(false);
    expect(isJunkLine(line("G/B A7 D"))).toBe(false);
  });

  it("fixes a lone pipe to I in lyric context", () => {
    expect(fixLyricWord("|")).toBe("I");
    expect(fixLyricWord("saw")).toBe("saw");
  });
});
