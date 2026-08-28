"use client";

import { useState } from "react";
import { ChordProPreviewPane } from "./ChordProPreviewPane";

/**
 * A ChordPro textarea paired with a live preview. The textarea is the
 * uncontrolled source of truth submitted with the form (via `name`); this
 * only mirrors its value into state to drive the preview pane.
 */
export function ChordProTextField({
  name,
  defaultValue = "",
  rows = 16,
}: {
  name: string;
  defaultValue?: string;
  rows?: number;
}) {
  const [text, setText] = useState(defaultValue);
  return (
    <div className="flex flex-col gap-3 md:flex-row">
      <textarea
        name={name}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={rows}
        spellCheck={false}
        className="flex-1 rounded border border-black/15 bg-transparent p-3 font-mono text-sm dark:border-white/20"
        placeholder={"{title: Amazing Grace}\n{key: G}\n\n[G]Amazing [G/B]grace, how [C]sweet the [G]sound"}
      />
      <div className="flex-1">
        <ChordProPreviewPane text={text} />
      </div>
    </div>
  );
}
