import { describe, expect, it } from "vitest";
import {
  capoShapeSounding,
  classifyLine,
  countTokens,
  fixChordOcr,
  fixLyricWord,
  isChordish,
  isJunkLine,
  isNeutralToken,
  normalizeChordToken,
  renderChordMark,
  resolveChordToken,
  resolvedChordTokens,
  SECTION_LABEL_RE,
  splitHyphenChordPair,
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

  it("a section label missing its opening bracket (left-margin clipping) is still a section", () => {
    for (const s of ["Verse 1]", "Chorus 1]", "Intro]", "Tag]"]) {
      expect(classifyLine(line(s)), s).toBe("section");
    }
  });

  it("a fully-bracketed label, e.g. [Intro], is still a section", () => {
    for (const s of ["[Intro]", "[Verse 1]", "[Pre-Chorus]", "[Tag]"]) {
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

  it("repairs an isolated bold C hallucinating a trailing c, but never Bb", () => {
    expect(fixChordOcr("Cc")).toBe("C");
    expect(isChordish("Cc")).toBe(true);
    // A real B-flat must never be touched -- it's a different string, not a
    // generalized "letter doubled with itself" rule.
    expect(fixChordOcr("Bb")).toBe("Bb");
    expect(isChordish("Bb")).toBe(true);
  });

  it("repairs an isolated bold C landing as lowercase c outright", () => {
    expect(fixChordOcr("c")).toBe("C");
    expect(isChordish("c")).toBe(true);
    expect(resolveChordToken("c")).toBe("C");
  });

  it("repairs an isolated bold C hallucinating a phantom leading G, but never a real Gm/G7/etc.", () => {
    // Confirmed against two independent scans: the reported word box is
    // narrow enough to match one character, and the pixels show a single
    // clean "C" with nothing before it -- same family as Cc/c.
    expect(fixChordOcr("GC")).toBe("C");
    expect(isChordish("GC")).toBe(true);
    // A different string than any real G-rooted chord, so none of those are
    // at risk of this literal match.
    for (const g of ["G", "Gm", "G7", "Gsus4", "G/B"]) {
      expect(fixChordOcr(g), g).toBe(g);
    }
  });

  it("repairs an isolated bold C hallucinating a phantom leading Q inside its own parens", () => {
    // Confirmed against the scan: the print is a clean "(C)"; Tesseract's
    // raw word is "(QC)", which normalizeChordToken strips down to "QC"
    // before this ever sees it -- a fourth variant of the same failure.
    expect(fixChordOcr("QC")).toBe("C");
    expect(isChordish("(QC)")).toBe(true);
    expect(resolveChordToken("(QC)")).toBe("C");
  });

  it("repairs sus4 hallucinating a trailing d", () => {
    // Confirmed against two independent scans/fonts: clean "Gsus4" print,
    // low OCR confidence (44-55%), identical phantom "d" both times.
    expect(fixChordOcr("Gsus4d")).toBe("Gsus4");
    expect(isChordish("Gsus4d")).toBe(true);
    expect(fixChordOcr("Csus4d")).toBe("Csus4");
  });

  it("repairs a slash chord's / misread as I, and # misread as a trailing f/¥", () => {
    expect(fixChordOcr("DIFf")).toBe("D/F#");
    expect(isChordish("DIFf")).toBe(true);
    expect(fixChordOcr("GIB")).toBe("G/B"); // no sharp misread, plain slash
    expect(isChordish("GIB")).toBe(true);
  });

  it("repairs a trailing sharp-glyph misread even when the / OCR'd correctly", () => {
    expect(fixChordOcr("D/Ff")).toBe("D/F#");
    expect(isChordish("D/Ff")).toBe(true);
    expect(fixChordOcr("F¥")).toBe("F#");
  });

  it("repairs a trailing sharp-glyph misread as a lone 's' -- a chordie.com printout", () => {
    // Real pilot-batch case: "A#" printed on a chordie.com chart OCR'd as
    // "As", not "Af"/"A¥" like the other sources -- same misread, different
    // glyph rendering.
    expect(fixChordOcr("As")).toBe("A#");
    expect(isChordish("As")).toBe(true);
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

  it("drops a browser print header/footer URL", () => {
    expect(isJunkLine(line("http://www .chordie.com/print.php"))).toBe(true);
    expect(isJunkLine(line("www.chordie.com"))).toBe(true);
  });

  it("drops chordie.com's print-footer disclaimer and page/timestamp stamp", () => {
    expect(
      isJunkLine(line("| This file is the author's own work and represents their interpretation |")),
    ).toBe(true);
    expect(isJunkLine(line(".of2 06/30/2009 1:57 PM"))).toBe(true);
  });

  it("fixes a lone pipe to I in lyric context", () => {
    expect(fixLyricWord("|")).toBe("I");
    expect(fixLyricWord("saw")).toBe("saw");
  });
});

describe("capo shape(sounding) notation", () => {
  it("recognizes shape(sounding) tokens as chordish, resolving to the sounding chord", () => {
    for (const [raw, sounding] of [
      ["B(G)", "G"],
      ["F#(D)", "D"],
      ["G#m(Em)", "Em"],
      ["E(C)", "C"],
      ["Bmaj7/D#(Gmaj7/B)", "Gmaj7/B"],
    ] as const) {
      expect(isChordish(raw), raw).toBe(true);
      expect(capoShapeSounding(raw), raw).toBe(sounding);
      expect(resolveChordToken(raw), raw).toBe(sounding);
    }
  });

  it("repairs a garbled sharp glyph on the sounding side (♯ misread as f or ¥)", () => {
    expect(capoShapeSounding("F#/A#(D/F¥)")).toBe("D/F#");
    expect(capoShapeSounding("F#/A#(D/Ff)")).toBe("D/F#");
  });

  it("never mistakes a chord already wrapped in its own parens for shape(sounding)", () => {
    expect(capoShapeSounding("(Em)")).toBeNull();
    expect(isChordish("(Em)")).toBe(true); // still a chord, via normalizeChordToken
  });

  it("is null/unaffected for ordinary chords and lyric words", () => {
    expect(capoShapeSounding("G")).toBeNull();
    expect(capoShapeSounding("Grace")).toBeNull();
    expect(resolveChordToken("G")).toBe("G");
  });
});

describe("hyphen-joined chord pairs", () => {
  it("splits a walk-up/turnaround shorthand like D-A into two chords", () => {
    expect(splitHyphenChordPair("D-A")).toEqual(["D", "A"]);
    expect(isChordish("D-A")).toBe(true);
    expect(renderChordMark("D-A")).toBe("[D][A]");
    expect(resolvedChordTokens("D-A")).toEqual(["D", "A"]);
  });

  it("still renders/resolves a single ordinary chord as one mark", () => {
    expect(splitHyphenChordPair("G")).toBeNull();
    expect(renderChordMark("G")).toBe("[G]");
    expect(resolvedChordTokens("G")).toEqual(["G"]);
  });

  it("never mistakes a real slash chord for a hyphen pair", () => {
    // D/A already parses as one chord (D with an A bass) -- the hyphen
    // splitter only ever sees a literal "-", so this never even reaches it,
    // but assert the end-to-end behavior stays a single chord regardless.
    expect(splitHyphenChordPair("D/A")).toBeNull();
    expect(renderChordMark("D/A")).toBe("[D/A]");
  });

  it("requires a real chord on both sides of the hyphen", () => {
    expect(splitHyphenChordPair("A-Grace")).toBeNull();
    expect(splitHyphenChordPair("-D")).toBeNull();
    expect(splitHyphenChordPair("D-")).toBeNull();
  });
});
