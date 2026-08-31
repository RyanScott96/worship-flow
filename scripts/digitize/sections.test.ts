import { describe, expect, it } from "vitest";
import type { PageMetrics } from "./lines";
import { walkPage } from "./sections";
import type { OcrLine, OcrWord } from "./types";

const LINE_H = 20;

/** Build vertically-stacked OCR lines from strings. `""` is a blank line; a
 *  leading `\n` before a string doubles the gap above it (soft break). */
function page(specs: string[]): { lines: OcrLine[]; metrics: PageMetrics } {
  const lines: OcrLine[] = [];
  let y = 0;
  for (const spec of specs) {
    const bigGap = spec.startsWith("\n");
    const text = bigGap ? spec.slice(1) : spec;
    if (bigGap) y += LINE_H * 2;
    const tokens = text.split(/\s+/).filter(Boolean);
    const words: OcrWord[] = tokens.map((t, i) => ({
      page: 1,
      block: 1,
      par: 1,
      line: lines.length,
      word: i,
      left: i * 120,
      top: y,
      width: 100,
      height: LINE_H,
      conf: 90,
      text: t,
    }));
    lines.push({
      key: `1.1.${lines.length}`,
      words,
      xLeft: 0,
      xRight: Math.max(tokens.length * 120, 1),
      yTop: y,
      yBottom: y + LINE_H,
      yMid: y + LINE_H / 2,
      height: LINE_H,
      text,
      meanConf: 90,
    });
    y += LINE_H + 6;
  }
  return {
    lines,
    metrics: { medianLineHeight: LINE_H, medianLineGap: 6, maxLineHeight: LINE_H },
  };
}

describe("walkPage", () => {
  it("wraps verse/chorus/bridge and title-cases the label", () => {
    const { lines, metrics } = page(["Verse 1", "Amazing grace how sweet", "CHORUS", "Praise the Lord"]);
    const w = walkPage(lines, metrics, false);
    expect(w.sections.map((s) => [s.type, s.label])).toEqual([
      ["verse", "Verse 1"],
      ["chorus", "Chorus"],
    ]);
  });

  it("turns Intro into a comment inside an untitled section", () => {
    const { lines, metrics } = page(["Intro", "G  C  D"]);
    const w = walkPage(lines, metrics, false);
    expect(w.sections[0].type).toBe(null);
    expect(w.sections[0].lines[0]).toMatchObject({ kind: "comment", text: "Intro" });
  });

  it("opens an untitled section on a wide blank gap", () => {
    const { lines, metrics } = page(["First line here", "\nSecond block here"]);
    const w = walkPage(lines, metrics, false);
    expect(w.sections).toHaveLength(2);
    expect(w.structure.unlabeledSections).toBe(1);
  });

  it("pairs a chord line with the lyric line beneath it", () => {
    const { lines, metrics } = page(["Verse", "G       C", "Amazing grace"]);
    const w = walkPage(lines, metrics, false);
    const text = w.sections[0].lines[0].text;
    expect(text).toContain("[G]");
    expect(text).toContain("[C]");
    expect(text.replace(/\[[^\]]*\]/g, "")).toBe("Amazing grace");
  });

  it("emits a lone chord line as an instrumental line", () => {
    const { lines, metrics } = page(["Verse", "Amazing grace", "G C D Em"]);
    const w = walkPage(lines, metrics, false);
    const last = w.sections[0].lines.at(-1)!;
    expect(last.text).toBe("[G][C][D][Em]");
    expect(w.structure.instrumentalLines).toBe(1);
  });

  it("stacks orphan chord lines above the paired lyric", () => {
    const { lines, metrics } = page(["Verse", "D A", "G C", "Amazing grace"]);
    const w = walkPage(lines, metrics, false);
    expect(w.structure.stackedChordLines).toBe(1);
    expect(w.sections[0].lines).toHaveLength(2);
  });

  it("picks a title on page 1 and skips it in the body", () => {
    const { lines, metrics } = page(["Amazing Grace", "Verse 1", "Twas grace that taught"]);
    const w = walkPage(lines, metrics, true);
    expect(w.titleCandidate).toBe("Amazing Grace");
    const bodyText = w.sections.flatMap((s) => s.lines.map((l) => l.text)).join("\n");
    expect(bodyText).not.toContain("Amazing Grace");
  });
});
