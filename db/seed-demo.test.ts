import { describe, expect, it } from "vitest";
import { DEMO_SONGS } from "./seed-demo";
import { parse, serialize, transposeDocument } from "../lib/chordpro";
import { extractChordSequence } from "../lib/chordpro/render";
import { deriveSourceKey } from "../lib/db/validation";
import { isValidChord } from "../lib/transpose";

// Every key a musician might transpose a demo chart into from the viewer.
const KEYS = ["C", "D", "E", "F", "G", "A", "Bb", "Eb", "Ab", "F#", "Am", "Em"];

describe("demo song charts", () => {
  it.each(DEMO_SONGS.map((s) => [s.title, s] as const))(
    "%s: parses, is fully chorded, transposes clean",
    (_title, song) => {
      const doc = parse(song.chordpro);

      // deriveSourceKey is what the seeder and the app both use; it also
      // validates the key. It must agree with the declared defaultKey.
      expect(deriveSourceKey(song.chordpro)).toBe(song.defaultKey);

      // Every chord token is valid under the grammar (docs/DOMAIN.md §2).
      const chords = extractChordSequence(doc);
      expect(chords.length).toBeGreaterThan(0);
      expect(chords.filter((c) => !isValidChord(c))).toEqual([]);

      // The bug this data fixes: every verse/chorus section carries chords,
      // not just the first one.
      for (const section of doc.sections) {
        if (!section.type) continue;
        const hasChord = section.lines.some(
          (l) => l.kind === "lyric" && l.segments.some((seg) => seg.chord),
        );
        expect(hasChord, `${section.type} "${section.label ?? ""}" has no chords`).toBe(
          true,
        );
      }

      // Transposes to every key without throwing and without producing an
      // invalid token.
      for (const key of KEYS) {
        const t = transposeDocument(doc, key);
        expect(
          extractChordSequence(t).filter((c) => !isValidChord(c)),
          `invalid token after transpose to ${key}`,
        ).toEqual([]);
      }

      // parse -> serialize -> parse keeps the chord sequence byte-identical.
      expect(extractChordSequence(parse(serialize(doc)))).toEqual(chords);
    },
  );

  it("covers exactly the five titles migration 0003 adopts", () => {
    expect(DEMO_SONGS.map((s) => s.title).sort()).toEqual(
      [
        "Amazing Grace",
        "Be Thou My Vision",
        "Come Thou Fount of Every Blessing",
        "Holy, Holy, Holy! Lord God Almighty",
        "It Is Well with My Soul",
      ].sort(),
    );
  });
});
