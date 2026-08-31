import { describe, expect, it } from "vitest";
import { groupLines, pageMetrics, parseTsv } from "./lines";

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
