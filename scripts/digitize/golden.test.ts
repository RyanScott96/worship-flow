import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { assembleChart } from "./assemble";
import { parseTsv } from "./lines";
import type { ManifestChart } from "./types";

const FIXTURES = path.join(import.meta.dirname, "__fixtures__");

/** Run assembleChart on a fixture dir's committed TSV. */
function extract(dir: string, tsvName = "words.tsv") {
  const chart = JSON.parse(
    readFileSync(path.join(dir, "manifest-entry.json"), "utf8"),
  ) as ManifestChart;
  const pageConfPath = path.join(dir, "pageconf.json");
  const pageMeanConfs = existsSync(pageConfPath)
    ? (JSON.parse(readFileSync(pageConfPath, "utf8")) as number[])
    : [93];
  return assembleChart({
    chart,
    pagesWords: [parseTsv(readFileSync(path.join(dir, tsvName), "utf8"))],
    pageMeanConfs,
  });
}

const names = readdirSync(FIXTURES, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
  .map((d) => d.name)
  .sort();

describe("golden fixtures", () => {
  it("covers the expected fixture set", () => {
    expect(names).toEqual([
      "clean-typeset",
      "faded-photocopy",
      "instrumental-stacked",
      "minor-no-printed-key",
      "scan-faded-vignette",
      "scan-skew-noise",
    ]);
  });

  for (const name of names) {
    it(`${name} extracts to its expected ChordPro and warnings`, () => {
      const a = extract(path.join(FIXTURES, name));
      const expectedPro = readFileSync(
        path.join(FIXTURES, name, "expected.pro"),
        "utf8",
      );
      const expectedWarnings = JSON.parse(
        readFileSync(path.join(FIXTURES, name, "expected.warnings.json"), "utf8"),
      );
      expect(a.chordproBody).toBe(expectedPro);
      expect({
        keyDetection: a.keyDetection,
        checks: a.checks,
        structure: a.structure,
        notes: a.notes,
      }).toEqual(expectedWarnings);
    });
  }

  it("scan-skew-noise: a deskewed, denoised scan extracts identically to the clean seed", () => {
    const dir = path.join(FIXTURES, "scan-skew-noise");
    expect(extract(dir, "words.tsv").chordproBody).toBe(
      extract(dir, "clean.tsv").chordproBody,
    );
  });

  it("scan-faded-vignette: below the OCR floor -> RE-SCAN note leads, flagged", () => {
    const a = extract(path.join(FIXTURES, "scan-faded-vignette"));
    expect(a.checks.ocrConfidence.flagged).toBe(true);
    expect(a.notes[0]).toMatch(/^RE-SCAN CANDIDATE/);
  });
});
