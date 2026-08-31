// Assemble the OCR walk into a ChordPro string, then round-trip it through the
// app's own parse()/serialize() so what we store is canonical long-form.

import { parse, serialize } from "../../lib/chordpro";
import type { OutSection } from "./sections";

/** Directive values can't contain braces or newlines (lib/chordpro/parse.ts). */
function clean(value: string): string {
  return value.replace(/[{}\r\n]/g, " ").replace(/\s+/g, " ").trim();
}

export interface BuildChordproInput {
  title: string;
  /** resolveKey-able. */
  key: string;
  copyright?: string | null;
  sections: OutSection[];
}

export function buildChordpro(input: BuildChordproInput): string {
  const out: string[] = [];
  out.push(`{title: ${clean(input.title)}}`);
  out.push(`{key: ${clean(input.key)}}`);
  if (input.copyright) out.push(`{comment: ${clean(input.copyright)}}`);
  out.push("");

  input.sections.forEach((s, idx) => {
    if (idx > 0) out.push("");
    if (s.type) {
      out.push(s.label ? `{start_of_${s.type}: ${clean(s.label)}}` : `{start_of_${s.type}}`);
    }
    for (const l of s.lines) {
      out.push(l.kind === "comment" ? `{comment: ${clean(l.text)}}` : l.text);
    }
    if (s.type) out.push(`{end_of_${s.type}}`);
  });

  // Collapse any run of blank lines the walk + serializer can leave between an
  // instrumental line and the next section.
  return serialize(parse(out.join("\n"))).replace(/\n{3,}/g, "\n\n");
}
