import { describe, expect, it, vi } from "vitest";
import {
  addSongItem,
  createService,
  moveServiceItem,
  updateServiceItem,
} from "./services";
import { ServiceValidationError } from "./validation";

/**
 * Stub for the Neon HTTP driver used as a tagged template. `handler` gets the
 * assembled SQL text (with `?` placeholders) and the interpolated values, and
 * returns the rows for that query. `sql.transaction` just awaits the list.
 */
function fakeSql(handler: (text: string, values: unknown[]) => unknown) {
  const tag = (strings: TemplateStringsArray, ...values: unknown[]) =>
    Promise.resolve(handler(strings.join("?").replace(/\s+/g, " ").trim(), values));
  const transaction = vi.fn((list: Promise<unknown>[]) => Promise.all(list));
  return Object.assign(tag, { transaction }) as never;
}

vi.mock("./client", () => ({ getSql: () => currentSql }));
let currentSql: ReturnType<typeof fakeSql>;

describe("createService", () => {
  it("rejects an unparseable date", async () => {
    currentSql = fakeSql(() => []);
    await expect(
      createService({ name: "x", startsAt: "not a date" }),
    ).rejects.toBeInstanceOf(ServiceValidationError);
  });

  it("inserts and returns the id for a good date", async () => {
    currentSql = fakeSql((text) => {
      if (text.startsWith("insert into service")) return [{ id: "svc-1" }];
      return [];
    });
    expect(await createService({ name: "Sunday", startsAt: "2026-09-06T10:00" })).toEqual({
      serviceId: "svc-1",
    });
  });
});

describe("item key / capo validation", () => {
  it("rejects a key the app doesn't recognize", async () => {
    currentSql = fakeSql(() => [{ pos: 0 }]);
    await expect(
      addSongItem("svc-1", { arrangementId: "arr-1", keyOverride: "H" }),
    ).rejects.toThrow(/isn't a key/);
  });

  it("rejects a capo outside 0..11", async () => {
    currentSql = fakeSql(() => [{ pos: 0 }]);
    await expect(
      updateServiceItem("item-1", { capo: "13" }),
    ).rejects.toThrow(/0 to 11/);
  });

  it("accepts an empty key / capo (falls back to the arrangement key)", async () => {
    const seen: string[] = [];
    currentSql = fakeSql((text) => {
      seen.push(text);
      return text.includes("max(position)") ? [{ pos: 3 }] : [];
    });
    await addSongItem("svc-1", { arrangementId: "arr-1", keyOverride: "  ", capo: "" });
    expect(seen.some((t) => t.startsWith("insert into service_item"))).toBe(true);
  });
});

describe("moveServiceItem", () => {
  const rows = [
    { id: "a", position: 0 },
    { id: "b", position: 1 },
    { id: "c", position: 2 },
  ];

  it("swaps positions with the neighbour above", async () => {
    const tx = vi.fn((list: Promise<unknown>[]) => Promise.all(list));
    currentSql = Object.assign(
      (strings: TemplateStringsArray, ...v: unknown[]) => {
        void v;
        return Promise.resolve(strings.join("").includes("select id, position") ? rows : []);
      },
      { transaction: tx },
    ) as never;

    await moveServiceItem("svc-1", "c", "up");
    expect(tx).toHaveBeenCalledOnce();
    expect(tx.mock.calls[0][0]).toHaveLength(2); // two UPDATE statements
  });

  it("is a no-op at the top edge", async () => {
    const tx = vi.fn();
    currentSql = Object.assign(
      (strings: TemplateStringsArray) =>
        Promise.resolve(strings.join("").includes("select id, position") ? rows : []),
      { transaction: tx },
    ) as never;

    await moveServiceItem("svc-1", "a", "up");
    expect(tx).not.toHaveBeenCalled();
  });

  it("is a no-op for an unknown item", async () => {
    const tx = vi.fn();
    currentSql = Object.assign(
      (strings: TemplateStringsArray) =>
        Promise.resolve(strings.join("").includes("select id, position") ? rows : []),
      { transaction: tx },
    ) as never;

    await moveServiceItem("svc-1", "zzz", "down");
    expect(tx).not.toHaveBeenCalled();
  });
});
