import { describe, expect, it, vi } from "vitest";
import {
  importChartRecord,
  normalizeTitle,
  resolveSongIdentity,
  type ImportableChart,
} from "./digitization";

// A stub for the Neon HTTP driver: `sql.query(text, params)` returns whatever
// the test queues; `sql.transaction(list)` awaits them all.
function fakeSql(handler: (text: string, params: unknown[]) => unknown) {
  const query = vi.fn((text: string, params: unknown[] = []) =>
    Promise.resolve(handler(text, params)),
  );
  const transaction = vi.fn((list: Promise<unknown>[]) => Promise.all(list));
  return Object.assign(query, { query, transaction }) as never;
}

const chart: ImportableChart = {
  idempotencyKey: "batch-1#0",
  arrangementName: "Amazing Grace",
  chordproBody: "{title: Amazing Grace}\n{key: G}\n\n[G]Amazing [C]grace",
  scanPdfPath: "scans/amazing-grace/original.pdf",
  scanPageCount: 1,
  pages: [{ pageNumber: 1, imagePath: "scans/amazing-grace/page-01.webp" }],
  extractionWarnings: { schema: 1, notes: [] },
};

describe("normalizeTitle", () => {
  it("drops articles, punctuation and case", () => {
    expect(normalizeTitle("The Heart of Worship!")).toBe("heart of worship");
    expect(normalizeTitle("O Come, O Come Emmanuel")).toBe("o come o come emmanuel");
  });
});

describe("resolveSongIdentity", () => {
  it("matches a clear winner", async () => {
    const sql = fakeSql(() => [
      { id: "s1", title: "Amazing Grace", score: 0.95 },
      { id: "s2", title: "Amazing Love", score: 0.32 },
    ]);
    expect(await resolveSongIdentity(sql, "Amazing Grace")).toEqual({
      decision: "matched",
      songId: "s1",
      matchedTitle: "Amazing Grace",
      score: 0.95,
    });
  });

  it("is ambiguous with two close candidates", async () => {
    const sql = fakeSql(() => [
      { id: "s1", title: "Here I Am", score: 0.52 },
      { id: "s2", title: "Here I Am to Worship", score: 0.48 },
    ]);
    const r = await resolveSongIdentity(sql, "Here I Am");
    expect(r.decision).toBe("ambiguous");
  });

  it("creates when nothing is close", async () => {
    const sql = fakeSql(() => []);
    expect(await resolveSongIdentity(sql, "Totally New Song")).toEqual({
      decision: "created",
    });
  });
});

describe("importChartRecord", () => {
  it("inserts when no row exists, creating a song", async () => {
    const sql = fakeSql((text) => {
      if (text.includes("from arrangement a")) return []; // findExisting
      if (text.includes("from song")) return []; // resolveSongIdentity -> created
      if (text.startsWith("with s as")) return [{ id: "a-new" }]; // insert
      return [];
    });
    const r = await importChartRecord(sql, chart);
    expect(r.outcome).toBe("inserted");
    expect(r.arrangementId).toBe("a-new");
    expect(r.songMatch.decision).toBe("created");
  });

  it("replaces a pristine existing row", async () => {
    const sql = fakeSql((text) => {
      if (text.includes("from arrangement a"))
        return [{ id: "a1", song_id: "s1", song_title: "Amazing Grace", review_status: "unverified", extraction_method: "ocr_geometric", revs: 0 }];
      return [];
    });
    const r = await importChartRecord(sql, chart);
    expect(r.outcome).toBe("replaced");
    expect(r.arrangementId).toBe("a1");
  });

  it("skips a verified row", async () => {
    const sql = fakeSql((text) => {
      if (text.includes("from arrangement a"))
        return [{ id: "a1", song_id: "s1", song_title: "Amazing Grace", review_status: "verified", extraction_method: "ocr_geometric", revs: 0 }];
      return [];
    });
    expect((await importChartRecord(sql, chart)).outcome).toBe("skipped");
  });

  it("skips a row that has been hand-edited (has revisions)", async () => {
    const sql = fakeSql((text) => {
      if (text.includes("from arrangement a"))
        return [{ id: "a1", song_id: "s1", song_title: "Amazing Grace", review_status: "unverified", extraction_method: "ocr_geometric", revs: 2 }];
      return [];
    });
    expect((await importChartRecord(sql, chart)).outcome).toBe("skipped");
  });

  it("stamps the resolved songMatch into the persisted extraction_warnings", async () => {
    let insertedWarnings: unknown;
    const sql = fakeSql((text, params) => {
      if (text.includes("from arrangement a")) return [];
      if (text.includes("from song")) return [];
      if (text.startsWith("with s as")) {
        insertedWarnings = JSON.parse(params[6] as string);
        return [{ id: "a-new" }];
      }
      return [];
    });
    await importChartRecord(sql, chart);
    expect(insertedWarnings).toMatchObject({ songMatch: { decision: "created" }, schema: 1 });
  });

  it("throws (caught upstream) when the key can't be derived", async () => {
    const sql = fakeSql(() => []);
    await expect(
      importChartRecord(sql, { ...chart, chordproBody: "{title: x}\n\nno key here" }),
    ).rejects.toThrow();
  });
});
