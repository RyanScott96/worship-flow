// Infer the {key: ...} directive. lib/db/validation.ts deriveSourceKey rejects
// an arrangement whose key is missing or unresolvable, so this ALWAYS returns
// one of the ~30 names resolveKey accepts — falling back to C with a loud note.

import { parseChord, resolveKey } from "../../lib/transpose";
import type { KeyDetectionMethod, OcrLine } from "./types";

function canResolve(key: string): boolean {
  try {
    resolveKey(key);
    return true;
  } catch {
    return false;
  }
}

/** Enharmonic spellings that resolveKey doesn't accept -> ones it does. */
const SWAP: Record<string, string> = {
  "A#": "Bb",
  "D#": "Eb",
  "G#": "Ab",
  Cb: "B",
  "E#": "F",
  Fb: "E",
  "B#": "C",
  Db: "C#", // only reached for a minor key; Db major resolves directly
  Gb: "F#", // ditto
};

/** Return a resolveKey-able key name for `raw`, or null. */
export function normalizeKey(raw: string): string | null {
  const t = raw.trim();
  if (canResolve(t)) return t;

  const isMinor = /m$/.test(t) && !/maj/i.test(t);
  const root = isMinor ? t.slice(0, -1) : t;
  const alt = SWAP[root];
  if (alt) {
    const cand = isMinor ? `${alt}m` : alt;
    if (canResolve(cand)) return cand;
  }
  return null;
}

const PRINTED_KEY_RE = /\bkey\s*(?:of|[:=])?\s*([A-G][#b]?m?)\b/i;
const LONE_KEY_RE = /^\(?([A-G][#b]?m?)\)?$/;

export interface KeyDetectInput {
  /** Every OCR line across all pages of the chart. */
  allLines: OcrLine[];
  /** Chord tokens in reading order (first entry = first chord on the chart). */
  chordTokens: string[];
  /** manifest chart.key, if the operator supplied one. */
  manifestKey?: string;
  /** The detected title line text, if any (scanned for a lone key token). */
  titleText?: string | null;
}

export interface KeyDetectResult {
  method: KeyDetectionMethod;
  key: string;
  confident: boolean;
  /** Set only for the fallback case. */
  note?: string;
}

function rootIsMinor(quality: string): boolean {
  return /^m(?!aj)/.test(quality);
}

export function detectKey(input: KeyDetectInput): KeyDetectResult {
  // 1. Printed key.
  for (const line of input.allLines) {
    const m = PRINTED_KEY_RE.exec(line.text);
    if (m) {
      const k = normalizeKey(m[1]);
      if (k) return { method: "printed", key: k, confident: true };
    }
  }
  if (input.titleText) {
    for (const tok of input.titleText.split(/\s+/)) {
      const lm = LONE_KEY_RE.exec(tok);
      if (lm && /[#b]|m$/.test(lm[1])) {
        const k = normalizeKey(lm[1]);
        if (k) return { method: "printed", key: k, confident: true };
      }
    }
  }

  // 2. Manifest hint.
  if (input.manifestKey) {
    const k = normalizeKey(input.manifestKey);
    if (k) return { method: "manifest-hint", key: k, confident: true };
  }

  // 3. First chord.
  const first = input.chordTokens[0] ? parseChord(input.chordTokens[0]) : null;
  if (first) {
    const cand = rootIsMinor(first.quality) ? `${first.root}m` : first.root;
    const k = normalizeKey(cand);
    if (k) return { method: "first-chord", key: k, confident: false };
  }

  // 4. Most common root (as a major key).
  const tally = new Map<string, number>();
  for (const tok of input.chordTokens) {
    const p = parseChord(tok);
    if (!p) continue;
    tally.set(p.root, (tally.get(p.root) ?? 0) + 1);
  }
  const modal = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (modal) {
    const k = normalizeKey(modal);
    if (k) return { method: "most-common", key: k, confident: false };
  }

  // 5. Fallback.
  return {
    method: "fallback",
    key: "C",
    confident: false,
    note: "KEY NOT DETECTED — forced {key: C}. Verify at practice.",
  };
}
