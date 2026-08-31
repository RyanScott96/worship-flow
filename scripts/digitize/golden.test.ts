import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { assembleChart } from "./assemble";
import { parseTsv } from "./lines";
import type { ManifestChart } from "./types";

const FIXTURES = path.join(import.meta.dirname, "__fixtures__");

/** The stable slice of an AssembledChart we pin per fixture. */
function golden(name: string) {
  const dir = path.join(FIXTURES, name);
  const tsv = readFileSync(path.join(dir, "words.tsv"), "utf8");
  const chart = JSON.parse(
    readFileSync(path.join(dir, "manifest-entry.json"), "utf8"),
  ) as ManifestChart;

  const a = assembleChart({
    chart,
    pagesWords: [parseTsv(tsv)],
    pageMeanConfs: [93],
  });

  return {
    chordproBody: a.chordproBody,
    keyDetection: a.keyDetection,
    checks: a.checks,
    structure: a.structure,
    notes: a.notes,
  };
}

const names = readdirSync(FIXTURES, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

describe("golden fixtures", () => {
  it("covers the four expected fixtures", () => {
    expect(names).toEqual([
      "clean-typeset",
      "faded-photocopy",
      "instrumental-stacked",
      "minor-no-printed-key",
    ]);
  });

  for (const name of names) {
    it(`${name} extracts to its expected ChordPro and warnings`, () => {
      const g = golden(name);
      const expectedPro = readFileSync(
        path.join(FIXTURES, name, "expected.pro"),
        "utf8",
      );
      const expectedWarnings = JSON.parse(
        readFileSync(path.join(FIXTURES, name, "expected.warnings.json"), "utf8"),
      );
      expect(g.chordproBody).toBe(expectedPro);
      expect({
        keyDetection: g.keyDetection,
        checks: g.checks,
        structure: g.structure,
        notes: g.notes,
      }).toEqual(expectedWarnings);
    });
  }
});
