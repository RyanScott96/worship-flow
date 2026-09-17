import { describe, expect, it } from "vitest";
import type { PageMetrics } from "./lines";
import { walkPage } from "./sections";
import type { OcrLine, OcrWord } from "./types";

const LINE_H = 20;

type LineSpec = string | { text: string; conf?: number; height?: number };

/** Build vertically-stacked OCR lines from strings. `""` is a blank line; a
 *  leading `\n` before a string doubles the gap above it (soft break). A
 *  `{ text, conf, height }` entry pins that line's OCR confidence and/or
 *  rendered height instead of the defaults (90, 20) -- for cases that hinge
 *  on a specific line being low-confidence or a particular size relative to
 *  its neighbours. */
function page(specs: LineSpec[]): { lines: OcrLine[]; metrics: PageMetrics } {
  const lines: OcrLine[] = [];
  let y = 0;
  for (const spec of specs) {
    const raw = typeof spec === "string" ? spec : spec.text;
    const conf = typeof spec === "string" ? 90 : spec.conf ?? 90;
    const h = typeof spec === "string" ? LINE_H : spec.height ?? LINE_H;
    const bigGap = raw.startsWith("\n");
    const text = bigGap ? raw.slice(1) : raw;
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
      height: h,
      conf,
      text: t,
    }));
    lines.push({
      key: `1.1.${lines.length}`,
      words,
      xLeft: 0,
      xRight: Math.max(tokens.length * 120, 1),
      yTop: y,
      yBottom: y + h,
      yMid: y + h / 2,
      height: h,
      text,
      meanConf: conf,
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

  it("strips brackets off a fully-bracketed label, e.g. [Intro]", () => {
    const { lines, metrics } = page(["[Intro]", "G  C  D"]);
    const w = walkPage(lines, metrics, false);
    expect(w.sections[0].lines[0]).toMatchObject({ kind: "comment", text: "Intro" });
  });

  it("maps Pre-Chorus to a verse and Tag to a chorus (no direct chordpro construct)", () => {
    const { lines, metrics } = page(["Pre-Chorus", "Your name is the highest", "Tag", "Amen"]);
    const w = walkPage(lines, metrics, false);
    expect(w.sections.map((s) => [s.type, s.label])).toEqual([
      ["verse", "Pre-Chorus"],
      ["chorus", "Tag"],
    ]);
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

  it("reads explicit Song:/Artist:/Album: metadata lines, order-independent", () => {
    const { lines, metrics } = page([
      "Artist: Chris Tomlin",
      "Album: Always",
      "Song: Holy Forever",
      "Verse 1",
      "A thousand generations",
    ]);
    const w = walkPage(lines, metrics, true);
    expect(w.titleCandidate).toBe("Holy Forever");
    expect(w.artist).toBe("Chris Tomlin");
    expect(w.album).toBe("Always");
    const bodyText = w.sections.flatMap((s) => s.lines.map((l) => l.text)).join("\n");
    expect(bodyText).not.toMatch(/Chris Tomlin|Always|Holy Forever/);
  });

  it("an explicit Song: line wins over the position-based heuristic", () => {
    const { lines, metrics } = page(["Some Big Header", "Song: Holy Forever", "Verse 1", "Lyrics"]);
    const w = walkPage(lines, metrics, true);
    expect(w.titleCandidate).toBe("Holy Forever");
  });

  it("picks the title by position even when it's not the tallest text on the page", () => {
    // Real pilot-batch shape: the genuine title is ordinary-sized (or even
    // smaller than something else on the page), so "near the page max
    // height" missed it as often as it caught it. Position in the narrow
    // band above the first chord/section line is what actually works.
    const { lines, metrics } = page(["If We Are The Body", "Casting Crowns", "Em C", "It's crowded"]);
    const w = walkPage(lines, metrics, true);
    expect(w.titleCandidate).toBe("If We Are The Body");
  });

  it("skips a publisher letterhead sitting above the real (taller) title", () => {
    // Real pilot-batch shape: "BETHEL MUSIC" (a short all-caps logo caption)
    // sits above "All Hail King Jesus" on the page. Position-first would
    // otherwise pick the letterhead.
    const { lines, metrics } = page([
      { text: "BETHEL MUSIC", height: 20 },
      { text: "All Hail King Jesus", height: 27 },
      "Verse 1",
      "There was a moment",
    ]);
    const w = walkPage(lines, metrics, true);
    expect(w.titleCandidate).toBe("All Hail King Jesus");
  });

  it("still picks a genuine all-caps title with no taller line right after it", () => {
    const { lines, metrics } = page(["NEVER ONCE", "Matt Redman", "Verse 1", "Standing on this mountain"]);
    const w = walkPage(lines, metrics, true);
    expect(w.titleCandidate).toBe("NEVER ONCE");
  });

  it("rejects a low-confidence garbled fragment as the title, falling through to the real one", () => {
    const { lines, metrics } = page([
      { text: "IN", conf: 10 },
      "Intro:",
      "Never Get's Old",
      "G Gm",
      "The more I see",
    ]);
    const w = walkPage(lines, metrics, true);
    // "Intro:" closes the title band (it's a section label), so the low-
    // confidence "IN" is the only line in-band -- correctly rejected, no
    // title guessed rather than trusting garbage.
    expect(w.titleCandidate).toBeNull();
  });

  it("strips a printed key hint fused onto the title line by fragment-merge", () => {
    const { lines, metrics } = page(["Hosanna Key - G", "Verse 1", "Hosanna in the highest"]);
    const w = walkPage(lines, metrics, true);
    expect(w.titleCandidate).toBe("Hosanna");
  });

  it("reads a bare artist/composer line right after the title, no punctuation needed", () => {
    const { lines, metrics } = page(["Came To My Rescue", "Hillsong", "Intro:", "G D"]);
    const w = walkPage(lines, metrics, true);
    expect(w.titleCandidate).toBe("Came To My Rescue");
    expect(w.artist).toBe("Hillsong");
  });

  it("reads a parenthesized composer credit right after the title", () => {
    const { lines, metrics } = page(["Great Things", "(Phil Wickham, Jonas Myrin)", "Verse 1", "Come let us worship"]);
    const w = walkPage(lines, metrics, true);
    expect(w.titleCandidate).toBe("Great Things");
    expect(w.artist).toBe("Phil Wickham, Jonas Myrin");
  });

  it("reads Written by ... as the artist", () => {
    const { lines, metrics } = page([
      "All Hail King Jesus",
      "Written by Ran Jackson, Peter Mattis",
      "Verse 1",
      "There was a moment",
    ]);
    const w = walkPage(lines, metrics, true);
    expect(w.titleCandidate).toBe("All Hail King Jesus");
    expect(w.artist).toBe("Ran Jackson, Peter Mattis");
    const bodyText = w.sections.flatMap((s) => s.lines.map((l) => l.text)).join("\n");
    expect(bodyText).not.toContain("Written by");
  });

  it("does not mistake a clipped key announcement right after the title for an artist credit", () => {
    // Real pilot-batch case: left-margin clipping ate the "O" off "ORIGINAL
    // KEY of C", leaving "RIGINAL KEY of C" -- a bare short line that would
    // otherwise look exactly like a composer credit.
    const { lines, metrics } = page(["It Is Well", "RIGINAL KEY of C", "Verse 1", "Grander earth has quaked"]);
    const w = walkPage(lines, metrics, true);
    expect(w.titleCandidate).toBe("It Is Well");
    expect(w.artist).toBeNull();
  });

  it("strips a stray trailing slash left on the title by handwriting bleed-through", () => {
    const { lines, metrics } = page(["Great Things /", "Verse 1", "Come let us worship"]);
    const w = walkPage(lines, metrics, true);
    expect(w.titleCandidate).toBe("Great Things");
  });

  it("does not mistake a long lyric line right after the title for an artist credit", () => {
    const { lines, metrics } = page([
      "Great Things",
      "Come let us worship our King and bow at His feet today",
      "Verse 1",
      "He has done great things",
    ]);
    const w = walkPage(lines, metrics, true);
    expect(w.titleCandidate).toBe("Great Things");
    // Too many words to be a plausible artist name -- the word-count cap on
    // the bare-line fallback keeps this out of {subtitle:}.
    expect(w.artist).toBeNull();
  });
});
