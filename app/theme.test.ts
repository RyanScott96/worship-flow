import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SKINS } from "../lib/theme";

/*
 * D-24: a theme change may only ever change token values. If switching skin or
 * mode breaks something, a component hardcoded a color — that's the bug, and
 * this file is what catches it. It also holds every skin to a contrast floor,
 * so a new palette can't ship unreadable chords.
 */

const ROOT = join(__dirname, "..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      // Vendored shadcn components may use `dark:` on tokens; they're exempt
      // from the dark: rule but not from the raw-color rule below.
      return sourceFiles(path);
    }
    return /\.(tsx|ts)$/.test(name) && !name.endsWith(".test.ts") ? [path] : [];
  });
}

const PALETTE =
  "black|white|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const RAW_COLOR = new RegExp(
  `\\b(?:text|bg|border|ring|divide|outline|fill|stroke|from|to|via|placeholder|decoration|caret|shadow)-(?:${PALETTE})\\b`,
);
const DARK_VARIANT = /\bdark:/;
const HEX_LITERAL = /["'`]#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3}(?:[0-9a-fA-F]{2})?)?["'`]/;

describe("components use role tokens only", () => {
  const files = [...sourceFiles(join(ROOT, "app")), ...sourceFiles(join(ROOT, "components"))];

  it.each(files.map((f) => [f.slice(ROOT.length + 1), f]))("%s", (_rel, file) => {
    const vendored = file.includes(join("components", "ui"));
    const offenders = readFileSync(file, "utf8")
      .split("\n")
      .map((line, i) => ({ line: line.trim(), n: i + 1 }))
      .filter(
        ({ line }) =>
          RAW_COLOR.test(line) || HEX_LITERAL.test(line) || (!vendored && DARK_VARIANT.test(line)),
      )
      .map(({ line, n }) => `${n}: ${line}`);
    expect(offenders, "use a token from app/globals.css instead").toEqual([]);
  });
});

// ── Contrast ────────────────────────────────────────────────────────────────

type Tokens = Record<string, { light: string; dark: string }>;

/** Each skin block's tokens, resolved to literal hex per mode. */
function skinTokens(): Record<string, Tokens> {
  const css = readFileSync(join(ROOT, "app", "globals.css"), "utf8");
  const skins: Record<string, Tokens> = {};
  for (const block of css.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
    const names = [...new Set([...block[1].matchAll(/\[data-skin="([\w-]+)"\]/g)].map((m) => m[1]))];
    if (names.length !== 1 || !block[2].includes("light-dark(")) continue; // print etc.
    // Tokens must be re-declared on inverse surfaces or they won't flip there
    // (see the Inverse surface note in globals.css).
    if (!block[1].includes(".surface-inverse")) {
      throw new Error(`skin ${names[0]}: its block must also target "… .surface-inverse"`);
    }
    const raw: Record<string, string> = {};
    for (const decl of block[2].matchAll(/--([\w-]+):\s*([^;]+);/g)) raw[decl[1]] = decl[2].trim();
    const tokens: Tokens = {};
    const resolve = (name: string): { light: string; dark: string } => {
      const value = raw[name];
      const ref = value?.match(/^var\(--([\w-]+)\)$/);
      if (ref) return resolve(ref[1]);
      const ld = value?.match(/^light-dark\((#[0-9a-fA-F]{6}),\s*(#[0-9a-fA-F]{6})\)$/);
      if (!ld) throw new Error(`skin ${names[0]}: --${name} must be light-dark(#hex, #hex) or var(--…), got ${value}`);
      return { light: ld[1], dark: ld[2] };
    };
    for (const name of Object.keys(raw)) tokens[name] = resolve(name);
    skins[names[0]] = tokens;
  }
  return skins;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// [foreground token, background token, minimum ratio]. 4.5 = WCAG AA body
// text; 3 = AA for UI component boundaries (inputs, focus rings).
const PAIRS: [string, string, number][] = [
  ["foreground", "background", 4.5],
  ["foreground", "card", 4.5],
  ["foreground", "muted", 4.5],
  ["foreground", "accent", 4.5],
  ["muted-foreground", "background", 4.5],
  ["muted-foreground", "card", 4.5],
  ["muted-foreground", "muted", 4.5],
  ["secondary-foreground", "secondary", 4.5],
  ["primary-foreground", "primary", 4.5],
  ["destructive-foreground", "destructive", 4.5],
  ["destructive", "background", 4.5],
  ["success", "background", 4.5],
  ["warning", "background", 4.5],
  ["chord", "background", 4.5],
  ["section-label", "background", 4.5],
  ["input", "background", 3],
  ["ring", "background", 3],
];

describe("skins", () => {
  const skins = skinTokens();

  it("every skin in lib/theme.ts has a token block, and vice versa", () => {
    expect(Object.keys(skins).sort()).toEqual([...SKINS].sort());
  });

  const cases = Object.entries(skins).flatMap(([skin, tokens]) =>
    (["light", "dark"] as const).flatMap((mode) =>
      PAIRS.map(([fg, bg, min]) => ({ skin, mode, fg, bg, min, tokens })),
    ),
  );

  it.each(cases)("$skin/$mode: $fg on $bg ≥ $min", ({ tokens, mode, fg, bg, min }) => {
    expect(tokens[fg], `--${fg} missing`).toBeDefined();
    expect(tokens[bg], `--${bg} missing`).toBeDefined();
    const ratio = contrast(tokens[fg][mode], tokens[bg][mode]);
    expect(ratio).toBeGreaterThanOrEqual(min);
  });
});
