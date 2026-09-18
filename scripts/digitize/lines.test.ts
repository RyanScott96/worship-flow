import { describe, expect, it } from "vitest";
import { groupLines, looksMultiColumn, pageMetrics, parseTsv } from "./lines";

const HEADER =
  "level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext";

interface W {
  level?: number;
  block?: number;
  par?: number;
  line?: number;
  word?: number;
  left: number;
  top: number;
  width: number;
  height: number;
  conf?: number;
  text: string;
}

function row(w: W): string {
  return [
    w.level ?? 5,
    1, // page_num
    w.block ?? 1,
    w.par ?? 1,
    w.line ?? 1,
    w.word ?? 1,
    w.left,
    w.top,
    w.width,
    w.height,
    w.conf ?? 90,
    w.text,
  ].join("\t");
}

function tsv(...rows: (string | W)[]): string {
  return [HEADER, ...rows.map((r) => (typeof r === "string" ? r : row(r)))].join("\n");
}

describe("parseTsv", () => {
  it("keeps only word rows with real text and non-negative confidence", () => {
    const input = tsv(
      { level: 1, left: 0, top: 0, width: 100, height: 100, conf: -1, text: "" },
      { line: 1, word: 1, left: 10, top: 10, width: 40, height: 18, conf: 96, text: "G" },
      { line: 1, word: 2, left: 80, top: 10, width: 44, height: 18, conf: 91, text: "C" },
      { line: 1, word: 3, left: 150, top: 10, width: 30, height: 18, conf: -1, text: "   " },
      { level: 4, left: 0, top: 0, width: 0, height: 0, conf: -1, text: "" },
    );
    const words = parseTsv(input);
    expect(words.map((w) => w.text)).toEqual(["G", "C"]);
    expect(words[0]).toMatchObject({ left: 10, width: 40, conf: 96 });
  });

  it("tolerates a missing header", () => {
    const input = row({ left: 0, top: 0, width: 10, height: 10, text: "A" });
    expect(parseTsv(input)).toHaveLength(1);
  });
});

describe("groupLines", () => {
  it("groups words by (block,par,line) and sorts by x", () => {
    const words = parseTsv(
      tsv(
        { line: 1, word: 2, left: 200, top: 10, width: 30, height: 18, text: "second" },
        { line: 1, word: 1, left: 10, top: 10, width: 30, height: 18, text: "first" },
        { line: 2, word: 1, left: 10, top: 60, width: 30, height: 18, text: "nextline" },
      ),
    );
    const lines = groupLines(words);
    expect(lines).toHaveLength(2);
    expect(lines[0].text).toBe("first second");
    expect(lines[0].xLeft).toBe(10);
    expect(lines[1].text).toBe("nextline");
  });

  it("merges vertically-overlapping horizontally-disjoint fragments", () => {
    const words = parseTsv(
      tsv(
        { par: 1, line: 1, left: 10, top: 10, width: 20, height: 18, text: "G" },
        { par: 2, line: 1, left: 400, top: 12, width: 20, height: 18, text: "C" },
      ),
    );
    const lines = groupLines(words);
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toBe("G C");
  });

  it("never merges fragments across a Tesseract block boundary", () => {
    // Under --psm 3, a two-column chart's columns land in separate blocks.
    // A left-column line and a right-column line at similar y are exactly
    // "vertically overlapping, horizontally disjoint" -- the fragment-merge
    // signal -- so without the block guard they'd wrongly glue back together.
    const leftCol = [
      { block: 1, par: 1, line: 1, word: 1, left: 200, top: 500, width: 100, height: 30, text: "Verse" },
      { block: 1, par: 1, line: 2, word: 1, left: 200, top: 550, width: 30, height: 30, text: "G" },
      { block: 1, par: 1, line: 3, word: 1, left: 200, top: 600, width: 200, height: 30, text: "There" },
    ];
    const rightCol = [
      { block: 2, par: 1, line: 1, word: 1, left: 1600, top: 502, width: 150, height: 30, text: "Chorus" },
      { block: 2, par: 1, line: 2, word: 1, left: 1600, top: 550, width: 30, height: 30, text: "C" },
      { block: 2, par: 1, line: 3, word: 1, left: 1600, top: 600, width: 200, height: 30, text: "Somehow" },
    ];
    const words = parseTsv(tsv(...leftCol, ...rightCol));
    const lines = groupLines(words);

    expect(lines.some((l) => l.text === "Verse Chorus")).toBe(false);
    const verseLine = lines.find((l) => l.text.includes("Verse"));
    const chorusLine = lines.find((l) => l.text.includes("Chorus"));
    expect(verseLine?.text).toBe("Verse");
    expect(chorusLine?.text).toBe("Chorus");
  });

  it("still merges same-block fragments on a page that also has a second block", () => {
    const leftCol = [
      { block: 1, par: 1, line: 1, word: 1, left: 200, top: 500, width: 100, height: 30, text: "Verse" },
      // A sparse chord row Tesseract fragmented into two lines -- both still
      // in block 1, so they should reunite as before.
      { block: 1, par: 2, line: 1, word: 1, left: 200, top: 550, width: 30, height: 30, text: "G" },
      { block: 1, par: 3, line: 1, word: 1, left: 700, top: 552, width: 30, height: 30, text: "D" },
      { block: 1, par: 1, line: 3, word: 1, left: 200, top: 600, width: 200, height: 30, text: "There" },
    ];
    const rightCol = [
      { block: 2, par: 1, line: 1, word: 1, left: 1600, top: 500, width: 150, height: 30, text: "Chorus" },
      { block: 2, par: 1, line: 2, word: 1, left: 1600, top: 550, width: 30, height: 30, text: "C" },
      { block: 2, par: 1, line: 3, word: 1, left: 1600, top: 600, width: 200, height: 30, text: "Somehow" },
    ];
    const words = parseTsv(tsv(...leftCol, ...rightCol));
    const lines = groupLines(words);

    expect(lines.some((l) => l.text === "G D")).toBe(true);
  });

  it("puts a logo above both columns before the columns, not inside the wrong one", () => {
    // Narrow enough to not count as "spanning" by width, but its own y-range
    // sits entirely above where both real columns start.
    const logo = [
      { block: 9, par: 1, line: 1, word: 1, left: 1500, top: 50, width: 200, height: 30, text: "LOGO" },
    ];
    const leftCol = [
      { block: 1, par: 1, line: 1, word: 1, left: 200, top: 500, width: 100, height: 30, text: "LeftA" },
      { block: 1, par: 1, line: 2, word: 1, left: 200, top: 550, width: 100, height: 30, text: "LeftB" },
      { block: 1, par: 1, line: 3, word: 1, left: 200, top: 600, width: 100, height: 30, text: "LeftC" },
    ];
    const rightCol = [
      { block: 2, par: 1, line: 1, word: 1, left: 1600, top: 500, width: 150, height: 30, text: "RightA" },
      { block: 2, par: 1, line: 2, word: 1, left: 1600, top: 550, width: 150, height: 30, text: "RightB" },
      { block: 2, par: 1, line: 3, word: 1, left: 1600, top: 600, width: 150, height: 30, text: "RightC" },
    ];
    const words = parseTsv(tsv(...logo, ...leftCol, ...rightCol));
    const lines = groupLines(words).map((l) => l.text);
    expect(lines).toEqual(["LOGO", "LeftA", "LeftB", "LeftC", "RightA", "RightB", "RightC"]);
  });

  it("orders same-column blocks by y even when Tesseract's block numbering doesn't match", () => {
    // Fed in an order that makes the later (higher-y) left block get
    // inserted into the grouping Map before the earlier one.
    const laterLeftBlock = [
      { block: 3, par: 1, line: 1, word: 1, left: 200, top: 600, width: 100, height: 30, text: "LeftLate" },
    ];
    const earlierLeftBlock = [
      { block: 1, par: 1, line: 1, word: 1, left: 200, top: 500, width: 100, height: 30, text: "LeftEarly" },
    ];
    const rightCol = [
      { block: 2, par: 1, line: 1, word: 1, left: 1600, top: 500, width: 150, height: 30, text: "RightTop" },
      { block: 2, par: 1, line: 2, word: 1, left: 1600, top: 600, width: 150, height: 30, text: "RightBottom" },
    ];
    const words = parseTsv(tsv(...laterLeftBlock, ...earlierLeftBlock, ...rightCol));
    const lines = groupLines(words).map((l) => l.text);
    expect(lines.indexOf("LeftEarly")).toBeLessThan(lines.indexOf("LeftLate"));
  });

  it("splits at a full-width block printed between two columns, instead of dumping it after both", () => {
    const leftCol = [
      { block: 1, par: 1, line: 1, word: 1, left: 200, top: 500, width: 100, height: 30, text: "LeftTop" },
      { block: 1, par: 1, line: 2, word: 1, left: 200, top: 800, width: 100, height: 30, text: "LeftBottom" },
    ];
    const rightCol = [
      { block: 2, par: 1, line: 1, word: 1, left: 1600, top: 500, width: 150, height: 30, text: "RightTop" },
      { block: 2, par: 1, line: 2, word: 1, left: 1600, top: 800, width: 150, height: 30, text: "RightBottom" },
    ];
    const bridge = [
      { block: 4, par: 1, line: 1, word: 1, left: 200, top: 650, width: 1550, height: 30, text: "Bridge" },
    ];
    const words = parseTsv(tsv(...leftCol, ...rightCol, ...bridge));
    const lines = groupLines(words).map((l) => l.text);
    expect(lines).toEqual(["LeftTop", "RightTop", "Bridge", "LeftBottom", "RightBottom"]);
  });

  it("does not duplicate a spanning block when the x-split isn't a real two-column layout", () => {
    // Real pilot-batch case ("Came to My Rescue"): a single-column chart
    // whose off-center title (narrow, so not "spanning") sat far enough
    // right of a couple of small end-of-song fragments (bare left margin)
    // that the boundary search read them as two columns. Those two
    // "columns" never vertically overlap -- the title is above the whole
    // body, the fragments are below it -- so colTop/colBottom (their
    // intersection) came out inverted, which made `before` (yTop < colTop)
    // and `after` (yTop >= colBottom) overlap instead of partition: the big
    // spanning body block in between landed in both and got emitted twice.
    const title = [
      { block: 1, par: 1, line: 1, word: 1, left: 900, top: 50, width: 600, height: 40, text: "Title" },
    ];
    const body = [
      { block: 2, par: 1, line: 1, word: 1, left: 100, top: 200, width: 200, height: 30, text: "BodyLeft" },
      { block: 2, par: 1, line: 2, word: 1, left: 1200, top: 260, width: 200, height: 30, text: "BodyRight" },
    ];
    const tailA = [
      { block: 3, par: 1, line: 1, word: 1, left: 100, top: 900, width: 150, height: 30, text: "TailA" },
    ];
    const tailB = [
      { block: 4, par: 1, line: 1, word: 1, left: 150, top: 960, width: 150, height: 30, text: "TailB" },
    ];
    const words = parseTsv(tsv(...title, ...body, ...tailA, ...tailB));
    const lines = groupLines(words).map((l) => l.text);
    expect(lines).toEqual(["Title", "BodyLeft", "BodyRight", "TailA", "TailB"]);
  });
});

describe("looksMultiColumn", () => {
  it("is false with too few words to judge", () => {
    const words = parseTsv(
      tsv(
        { left: 10, top: 10, width: 20, height: 18, text: "G" },
        { left: 900, top: 10, width: 20, height: 18, text: "C" },
      ),
    );
    expect(looksMultiColumn(words)).toBe(false);
  });

  it("is false for a chord chart's chords scattered across a wide single column", () => {
    // Chords legitimately land anywhere above their syllable -- a wide
    // spread isn't itself a column signal.
    const words = parseTsv(
      tsv(
        ...Array.from({ length: 20 }, (_, i) => ({
          left: i * 100,
          top: 100 + i * 20,
          width: 60,
          height: 30,
          text: `w${i}`,
        })),
      ),
    );
    expect(looksMultiColumn(words)).toBe(false);
  });

  it("is true for two clear column clusters", () => {
    const words = parseTsv(
      tsv(
        ...Array.from({ length: 5 }, (_, i) => ({
          left: 200 + i * 20,
          top: 100 + i * 60,
          width: 60,
          height: 30,
          text: `left${i}`,
        })),
        ...Array.from({ length: 5 }, (_, i) => ({
          left: 1600 + i * 20,
          top: 100 + i * 60,
          width: 60,
          height: 30,
          text: `right${i}`,
        })),
      ),
    );
    expect(looksMultiColumn(words)).toBe(true);
  });

  it("catches a dense two-column page the pooled-word-gap check alone would miss", () => {
    // Several --psm-4-merged lines, each with its own genuine left/right
    // column split -- but the left-column portion is a different length on
    // every line, so pooled across the page those in-between positions fill
    // in the gap and hide it from a single global gutter. Each line's *own*
    // gap is still anomalously large relative to its own other gaps, which
    // hasFragmentedLineSeams checks per line rather than pooling positions.
    const lineSpecs = [
      [0, 60, 300, 1050],
      [0, 90, 400, 1100],
      [0, 40, 500, 1150],
      [0, 120, 600, 1200],
    ];
    const rows = lineSpecs.flatMap((lefts, li) =>
      lefts.map((left, wi) => ({
        line: li + 1,
        word: wi + 1,
        left,
        top: 100 + li * 60,
        width: 30,
        height: 30,
        text: `w${li}_${wi}`,
      })),
    );
    const words = parseTsv(tsv(...rows));
    expect(looksMultiColumn(words)).toBe(true);
  });

  it("is false for many single-column lines with ordinary, non-anomalous word spacing", () => {
    // Varying word widths per line (unlike a repeated fixed grid) so real
    // prose's natural left-position variety doesn't itself create an
    // artificial clump-and-gap pattern.
    const widths = [50, 70, 40, 90, 60, 80];
    const rows = Array.from({ length: 10 }, (_, li) =>
      Array.from({ length: 6 }, (_, wi) => {
        let left = 0;
        for (let k = 0; k < wi; k++) left += widths[(k + li) % widths.length] + 15;
        return {
          line: li + 1,
          word: wi + 1,
          left,
          top: 100 + li * 40,
          width: widths[(wi + li) % widths.length],
          height: 30,
          text: `w${li}_${wi}`,
        };
      }),
    ).flat();
    const words = parseTsv(tsv(...rows));
    expect(looksMultiColumn(words)).toBe(false);
  });
});

describe("pageMetrics", () => {
  it("computes median line height and gap", () => {
    const words = parseTsv(
      tsv(
        { line: 1, left: 0, top: 0, width: 30, height: 20, text: "a" },
        { line: 2, left: 0, top: 40, width: 30, height: 20, text: "b" },
        { line: 3, left: 0, top: 80, width: 30, height: 20, text: "c" },
      ),
    );
    const m = pageMetrics(groupLines(words));
    expect(m.medianLineHeight).toBe(20);
    expect(m.medianLineGap).toBe(20);
  });
});
