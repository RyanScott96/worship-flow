import { describe, expect, it } from "vitest";
import { resolveKey } from "../../lib/transpose";
import { detectKey, normalizeKey } from "./keydetect";
import type { OcrLine } from "./types";

function lines(...texts: string[]): OcrLine[] {
  return texts.map((text, i) => ({
    key: `1.1.${i}`,
    words: text.split(/\s+/).filter(Boolean).map((t, j) => ({
      page: 1, block: 1, par: 1, line: i, word: j,
      left: j * 100, top: i * 20, width: 80, height: 18, conf: 90, text: t,
    })),
    xLeft: 0, xRight: 100, yTop: i * 20, yBottom: i * 20 + 18, yMid: i * 20 + 9,
    height: 18, text, meanConf: 90,
  }));
}

describe("normalizeKey", () => {
  it("passes through valid names", () => {
    for (const k of ["G", "Bb", "F#m", "Ebm", "C"]) expect(normalizeKey(k)).toBe(k);
  });
  it("swaps unresolvable enharmonics", () => {
    expect(normalizeKey("A#")).toBe("Bb");
    expect(normalizeKey("D#")).toBe("Eb");
    expect(normalizeKey("Dbm")).toBe("C#m");
  });
  it("returns null for nonsense", () => {
    expect(normalizeKey("H")).toBe(null);
  });
});

describe("detectKey", () => {
  it("reads a printed key", () => {
    const r = detectKey({ allLines: lines("Key of G", "G C D"), chordTokens: ["G", "C", "D"] });
    expect(r).toMatchObject({ method: "printed", key: "G", confident: true });
  });

  it("uses the manifest hint when nothing is printed", () => {
    const r = detectKey({ allLines: lines("G C D"), chordTokens: ["C", "G"], manifestKey: "D" });
    expect(r).toMatchObject({ method: "manifest-hint", key: "D" });
  });

  it("falls back to the first chord (major)", () => {
    const r = detectKey({ allLines: lines("G C D G"), chordTokens: ["G", "C", "D", "G"] });
    expect(r).toMatchObject({ method: "first-chord", key: "G", confident: false });
  });

  it("falls back to the first chord (minor)", () => {
    const r = detectKey({ allLines: lines("Em C G D"), chordTokens: ["Em", "C", "G", "D"] });
    expect(r).toMatchObject({ method: "first-chord", key: "Em" });
  });

  it("normalizes an enharmonic first chord", () => {
    const r = detectKey({ allLines: lines("A# D# G#"), chordTokens: ["A#", "D#", "G#"] });
    expect(r.key).toBe("Bb");
  });

  it("forces C with a loud note when there are no chords", () => {
    const r = detectKey({ allLines: lines("just some words"), chordTokens: [] });
    expect(r).toMatchObject({ method: "fallback", key: "C", confident: false });
    expect(r.note).toMatch(/KEY NOT DETECTED/);
  });

  it("every result resolves", () => {
    const cases = [
      detectKey({ allLines: lines("Key: Bb"), chordTokens: [] }),
      detectKey({ allLines: lines(""), chordTokens: ["F#m"] }),
      detectKey({ allLines: lines(""), chordTokens: [] }),
    ];
    for (const c of cases) expect(() => resolveKey(c.key)).not.toThrow();
  });
});
