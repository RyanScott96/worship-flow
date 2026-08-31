// Walk a page's classified lines: detect section labels and soft breaks, pair
// chord lines with the lyric line beneath them, and emit ChordPro line strings.
// The parser only wraps verse/chorus/bridge (lib/chordpro/directives.ts), so
// every other label (intro, tag, coda, ...) becomes a {comment:} in an
// untitled section.

import { classifyLine, isChordish, normalizeChordToken, SECTION_LABEL_RE } from "./classify";
import type { PageMetrics } from "./lines";
import { spliceChordsIntoLyric } from "./splice";
import type { LineClass, OcrLine } from "./types";

export type OutSectionType = "verse" | "chorus" | "bridge" | null;

export interface OutLine {
  kind: "lyric" | "comment";
  text: string;
  /** 0-based index of the OCR line this came from, for warning context. */
  sourceLine: number;
}

export interface OutSection {
  type: OutSectionType;
  label: string | null;
  lines: OutLine[];
}

export interface PageWalk {
  sections: OutSection[];
  /** Best title candidate from this page (page 1 only, else null). */
  titleCandidate: string | null;
  copyrightLine: string | null;
  /** Chord tokens in reading order — feeds key detection. */
  chordTokens: string[];
  structure: {
    stackedChordLines: number;
    instrumentalLines: number;
    unlabeledSections: number;
  };
  counts: { chordLines: number; lyricLines: number };
}

const WRAPPED: Record<string, OutSectionType> = {
  verse: "verse",
  chorus: "chorus",
  refrain: "chorus",
  bridge: "bridge",
};

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Parse a section-label line into a wrapped type (or null) and a display label. */
function parseLabel(text: string): { type: OutSectionType; label: string } {
  const m = SECTION_LABEL_RE.exec(text);
  const word = (m?.[1] ?? "").toLowerCase().replace(/[-\s]/g, "");
  // "prechorus", "intro", "tag", ... aren't in WRAPPED -> untitled section.
  const type = WRAPPED[word] ?? null;
  const label = titleCase(text.trim().replace(/[:.)-]\s*$/, "").trim());
  return { type, label };
}

export function walkPage(
  lines: OcrLine[],
  metrics: PageMetrics,
  isFirstPage: boolean,
): PageWalk {
  const classes: LineClass[] = lines.map(classifyLine);

  const sections: OutSection[] = [];
  // Held in an object so TS flow analysis doesn't pin `current` to null across
  // the mutating helper calls below.
  const state: { current: OutSection | null } = { current: null };
  const structure = { stackedChordLines: 0, instrumentalLines: 0, unlabeledSections: 0 };
  const counts = { chordLines: 0, lyricLines: 0 };
  const chordTokens: string[] = [];
  let pendingChords: OcrLine[] = [];

  const ensure = (): OutSection => {
    if (!state.current) {
      state.current = { type: null, label: null, lines: [] };
      sections.push(state.current);
    }
    return state.current;
  };
  const open = (type: OutSectionType, label: string | null) => {
    state.current = { type, label, lines: [] };
    sections.push(state.current);
  };
  const flushPendingAsInstrumental = () => {
    for (const c of pendingChords) {
      ensure().lines.push({
        kind: "lyric",
        text: spliceChordsIntoLyric(c, null).text,
        sourceLine: lines.indexOf(c),
      });
      structure.instrumentalLines++;
    }
    pendingChords = [];
  };

  // Title band: lines above the first chord/section line on page 1.
  let firstStructuralLine = classes.findIndex((c) => c === "chord" || c === "section");
  if (firstStructuralLine === -1) firstStructuralLine = lines.length;
  let titleCandidate: string | null = null;
  let copyrightLine: string | null = null;
  if (isFirstPage) {
    for (let i = 0; i < firstStructuralLine; i++) {
      if (classes[i] !== "lyric") continue;
      const t = lines[i].text.trim();
      if (/ccli|copyright|©/i.test(t)) {
        copyrightLine ??= t;
        continue;
      }
      const words = t.split(/\s+/).filter(Boolean);
      const bigEnough = lines[i].height >= 0.9 * metrics.maxLineHeight;
      if (!titleCandidate && words.length <= 6 && words.length >= 1 && bigEnough) {
        titleCandidate = t;
      }
    }
  }

  const titleLineIndices = new Set<number>();
  if (titleCandidate) {
    titleLineIndices.add(lines.findIndex((l) => l.text.trim() === titleCandidate));
  }
  if (copyrightLine) {
    titleLineIndices.add(lines.findIndex((l) => l.text.trim() === copyrightLine));
  }

  let lastContentBottom: number | null = null;
  const softBreakThreshold = 1.8 * Math.max(metrics.medianLineGap, 1);

  for (let i = 0; i < lines.length; i++) {
    if (titleLineIndices.has(i)) continue;
    const cls = classes[i];
    const line = lines[i];

    if (cls === "blank") continue; // whitespace; the gap check below spans it

    // A wide vertical gap between content lines with no label is a soft section
    // break. Scanners rarely emit an actual blank OCR line for a paragraph gap.
    if (
      cls !== "section" &&
      lastContentBottom !== null &&
      state.current &&
      state.current.lines.length > 0 &&
      line.yTop - lastContentBottom > softBreakThreshold
    ) {
      flushPendingAsInstrumental();
      open(null, null);
      structure.unlabeledSections++;
    }
    lastContentBottom = line.yBottom;

    if (cls === "section") {
      flushPendingAsInstrumental();
      const { type, label } = parseLabel(line.text);
      if (type) {
        open(type, label || null);
      } else {
        open(null, null);
        ensure().lines.push({ kind: "comment", text: label, sourceLine: i });
      }
      continue;
    }

    if (cls === "chord") {
      counts.chordLines++;
      pendingChords.push(line);
      for (const w of line.words) {
        if (isChordish(w.text)) chordTokens.push(normalizeChordToken(w.text));
      }
      continue;
    }

    // cls === "lyric"
    counts.lyricLines++;
    if (pendingChords.length === 0) {
      ensure().lines.push({
        kind: "lyric",
        text: line.words.map((w) => w.text).join(" "),
        sourceLine: i,
      });
      continue;
    }
    const partner = pendingChords[pendingChords.length - 1];
    const orphans = pendingChords.slice(0, -1);
    for (const o of orphans) {
      ensure().lines.push({
        kind: "lyric",
        text: spliceChordsIntoLyric(o, null).text,
        sourceLine: lines.indexOf(o),
      });
      structure.stackedChordLines++;
    }
    ensure().lines.push({
      kind: "lyric",
      text: spliceChordsIntoLyric(partner, line).text,
      sourceLine: i,
    });
    pendingChords = [];
  }

  flushPendingAsInstrumental();

  // Drop any empty sections the walk opened but never filled.
  return {
    sections: sections.filter((s) => s.lines.length > 0),
    titleCandidate,
    copyrightLine,
    chordTokens,
    structure,
    counts,
  };
}
