import { describe, expect, it } from "vitest";
import { parse } from "../../lib/chordpro";
import { buildChordpro } from "./buildChordpro";
import type { OutSection } from "./sections";
import { runValidators } from "./validators";

function verse(...lineTexts: string[]): OutSection {
  return {
    type: "verse",
    label: "Verse 1",
    lines: lineTexts.map((text, i) => ({ kind: "lyric" as const, text, sourceLine: i })),
  };
}

const base = {
  key: "G",
  chordLines: 2,
  lyricLines: 4,
  expectedPageCount: 1,
  actualPageCount: 1,
  meanOcrConf: 92,
  confFloor: 75,
  sections: [] as OutSection[],
};

describe("runValidators", () => {
  it("flags a bracketed token that isn't a chord", () => {
    const checks = runValidators({
      ...base,
      sections: [verse("[G]Amazing [Xyz]grace")],
    });
    expect(checks.unparseableChords).toEqual([
      { line: 0, token: "Xyz", context: "[G]Amazing [Xyz]grace" },
    ]);
  });

  it("flags a chord outside the detected key with its degree", () => {
    const checks = runValidators({
      ...base,
      sections: [verse("[G]Amazing [Eb]grace")],
    });
    expect(checks.nonDiatonicChords).toEqual([{ chord: "Eb", key: "G", degree: "bVI" }]);
  });

  it("does not flag diatonic chords or slash chords in key", () => {
    const checks = runValidators({
      ...base,
      sections: [verse("[G]Amazing [G/B]grace how [C]sweet the [D]sound")],
    });
    expect(checks.nonDiatonicChords).toEqual([]);
    expect(checks.unparseableChords).toEqual([]);
  });

  it("flags a chord/lyric ratio that is too high", () => {
    const checks = runValidators({ ...base, chordLines: 10, lyricLines: 2 });
    expect(checks.chordLyricRatio.flagged).toBe(true);
  });

  it("flags when there are no chords at all", () => {
    const checks = runValidators({ ...base, chordLines: 0, lyricLines: 6 });
    expect(checks.chordLyricRatio.flagged).toBe(true);
  });

  it("flags a page-count mismatch", () => {
    const checks = runValidators({ ...base, expectedPageCount: 2, actualPageCount: 1 });
    expect(checks.pageCount).toEqual({ expected: 2, actual: 1, flagged: true });
  });

  it("flags a chart whose mean OCR confidence is below the floor", () => {
    expect(runValidators({ ...base, meanOcrConf: 58 }).ocrConfidence).toEqual({
      meanConf: 58,
      floor: 75,
      flagged: true,
    });
    expect(runValidators({ ...base, meanOcrConf: 90 }).ocrConfidence.flagged).toBe(false);
  });
});

describe("buildChordpro", () => {
  it("emits canonical long-form that re-parses cleanly", () => {
    const body = buildChordpro({
      title: "Amazing Grace",
      key: "G",
      sections: [verse("[G]Amazing [G/B]grace how [C]sweet the [G]sound")],
    });
    expect(body).toContain("{title: Amazing Grace}");
    expect(body).toContain("{key: G}");
    expect(body).toContain("{start_of_verse: Verse 1}");
    expect(body).toContain("{end_of_verse}");
    const doc = parse(body);
    expect(doc.directives.key).toBe("G");
    expect(doc.sections[0].type).toBe("verse");
  });

  it("strips braces and newlines from directive values", () => {
    const body = buildChordpro({
      title: "Weird {title}\nsecond line",
      key: "C",
      sections: [verse("[C]hello")],
    });
    expect(body).toContain("{title: Weird title second line}");
  });
});
