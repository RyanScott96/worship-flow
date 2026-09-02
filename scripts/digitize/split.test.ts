import { describe, expect, it } from "vitest";
import { loadManifest } from "./manifest";
import { buildManifestObject, marksToCharts } from "./split";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

describe("marksToCharts", () => {
  it("turns marks into contiguous page ranges, last chart runs to the end", () => {
    const { charts, leadingUnassigned } = marksToCharts([1, 3, 6], 8);
    expect(leadingUnassigned).toBe(0);
    expect(charts).toEqual([
      { index: 0, pageStart: 1, pageEnd: 2, expectedPageCount: 2 },
      { index: 1, pageStart: 3, pageEnd: 5, expectedPageCount: 3 },
      { index: 2, pageStart: 6, pageEnd: 8, expectedPageCount: 3 },
    ]);
  });

  it("a single mark is one chart spanning the whole PDF", () => {
    expect(marksToCharts([1], 4).charts).toEqual([
      { index: 0, pageStart: 1, pageEnd: 4, expectedPageCount: 4 },
    ]);
  });

  it("counts pages before the first mark as unassigned and drops them", () => {
    const { charts, leadingUnassigned } = marksToCharts([3, 5], 6);
    expect(leadingUnassigned).toBe(2);
    expect(charts[0]).toEqual({ index: 0, pageStart: 3, pageEnd: 4, expectedPageCount: 2 });
  });

  it("sorts and de-dups the marks", () => {
    const { charts } = marksToCharts([6, 1, 3, 3, 1], 8);
    expect(charts.map((c) => c.pageStart)).toEqual([1, 3, 6]);
  });

  it("rejects empty marks, out-of-range pages, and a bad page count", () => {
    expect(() => marksToCharts([], 8)).toThrow(/no pages marked/);
    expect(() => marksToCharts([1, 9], 8)).toThrow(/outside 1\.\.8/);
    expect(() => marksToCharts([0], 8)).toThrow(/outside 1\.\.8/);
    expect(() => marksToCharts([1], 0)).toThrow(/positive integer/);
  });
});

describe("buildManifestObject", () => {
  it("produces an object that parseManifest accepts", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "split-test-"));
    const { charts } = marksToCharts([1, 3], 4);
    const obj = buildManifestObject(
      { batchId: "binder-01-2026-09", sourcePdfBasename: "binder-01.pdf", dpi: 300, charts },
      dir,
    );
    expect(obj.batchId).toBe("binder-01-2026-09");
    expect(obj.charts).toHaveLength(2);

    const file = path.join(dir, "manifest.json");
    await writeFile(file, JSON.stringify(obj, null, 2));
    const parsed = await loadManifest(file);
    expect(parsed.charts.map((c) => [c.pageStart, c.pageEnd])).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it("rejects a batchId the pipeline would reject", () => {
    const { charts } = marksToCharts([1], 2);
    expect(() =>
      buildManifestObject(
        { batchId: "bad id!", sourcePdfBasename: "x.pdf", dpi: 300, charts },
        tmpdir(),
      ),
    ).toThrow();
  });
});
