// Shared types for the digitization pipeline. See scripts/digitize/README.md and
// docs/ROADMAP.md Phase 1.5.

// ---------------------------------------------------------------------------
// manifest.json — the hand-authored input contract (D-09 splitter is separate)
// ---------------------------------------------------------------------------

export interface ManifestChart {
  /** Stable ordinal within the batch. Part of the idempotency key. */
  index: number;
  /** Advisory only — OCR still extracts its own title. */
  title?: string;
  /** 1-based, inclusive, into the source PDF. */
  pageStart: number;
  /** 1-based, inclusive. `>= pageStart`. */
  pageEnd: number;
  /**
   * Physical sheets the operator counted feeding the scanner. Normally
   * `pageEnd - pageStart + 1`; a mismatch is a silent double-feed (validator 4).
   */
  expectedPageCount: number;
  /** Per-chart override of the batch `sourcePdf`. */
  sourcePdf?: string;
  /** Operator key hint. Used ONLY when auto-detection fails. Must `resolveKey`. */
  key?: string;
}

export interface Manifest {
  /** Stable, `/^[a-z0-9][a-z0-9._-]*$/i`. The idempotency namespace. */
  batchId: string;
  /** Relative to the manifest file's directory. */
  sourcePdf?: string;
  /** Scan resolution, passed to `pdftoppm -r`. Default 300. */
  dpi: number;
  charts: ManifestChart[];
  /** Absolute path of the directory the manifest was loaded from. */
  baseDir: string;
}

// ---------------------------------------------------------------------------
// OCR intermediate — parsed Tesseract TSV
// ---------------------------------------------------------------------------

export interface OcrWord {
  page: number;
  block: number;
  par: number;
  line: number;
  word: number;
  left: number;
  top: number;
  width: number;
  height: number;
  /** Tesseract confidence 0..100. */
  conf: number;
  text: string;
}

export interface OcrLine {
  /** `${block}.${par}.${line}` — Tesseract's own line segmentation. */
  key: string;
  /** Sorted by `left`. */
  words: OcrWord[];
  xLeft: number;
  xRight: number;
  yTop: number;
  yBottom: number;
  yMid: number;
  height: number;
  /** `words.join(' ')` — for classification / regexes ONLY, never for the splice. */
  text: string;
  meanConf: number;
}

export type LineClass = "chord" | "lyric" | "section" | "blank";

// ---------------------------------------------------------------------------
// Extraction output
// ---------------------------------------------------------------------------

export type SongMatch =
  | { decision: "matched"; songId: string; matchedTitle: string; score: number }
  | { decision: "created" }
  | {
      decision: "ambiguous";
      candidates: { songId: string; title: string; score: number }[];
    }
  | { decision: "deferred" };

export type KeyDetectionMethod =
  | "printed"
  | "manifest-hint"
  | "first-chord"
  | "most-common"
  | "fallback";

export interface ExtractionWarnings {
  schema: 1;
  batchId: string;
  index: number;
  extractedAt: string;
  meanOcrConf: number;
  songMatch: SongMatch;
  keyDetection: {
    method: KeyDetectionMethod;
    key: string;
    confident: boolean;
  };
  checks: {
    unparseableChords: { line: number; token: string; context: string }[];
    nonDiatonicChords: { chord: string; key: string; degree: string }[];
    chordLyricRatio: {
      chordLines: number;
      lyricLines: number;
      ratio: number;
      flagged: boolean;
    };
    pageCount: { expected: number; actual: number; flagged: boolean };
  };
  structure: {
    stackedChordLines: number;
    instrumentalLines: number;
    unlabeledSections: number;
    multiColumnSuspected: boolean;
  };
  /** Loud, human-facing lines surfaced in report.md. */
  notes: string[];
}

export interface ChartRecord {
  batchId: string;
  index: number;
  /** `${batchId}#${index}` -> arrangement.extraction_batch_key */
  idempotencyKey: string;
  manifestTitle: string | null;
  extractedTitle: string | null;
  arrangementName: string;
  /** Guaranteed `resolveKey`-able; also the `{key:}` inside `chordproBody`. */
  sourceKey: string;
  /** Normalized: built as a string, then `parse()` -> `serialize()`. */
  chordproBody: string;
  scan: {
    /** Relative, e.g. `scans/<slug>/original.pdf`. */
    pdfPath: string;
    pageCount: number;
    pages: { pageNumber: number; imagePath: string }[];
  };
  extractionMethod: "ocr_geometric";
  songMatch: SongMatch;
  metrics: {
    meanOcrConf: number;
    chordLineCount: number;
    lyricLineCount: number;
    chordLyricRatio: number;
  };
  warnings: ExtractionWarnings;
}

export type ImportOutcome = "inserted" | "replaced" | "skipped" | "failed";
