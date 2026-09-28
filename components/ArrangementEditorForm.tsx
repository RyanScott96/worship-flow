"use client";

import { useActionState, useState } from "react";
import { saveArrangementAction, type FormState } from "@/app/songs/actions";
import { ChordProTextField } from "./ChordProTextField";
import { ChordProPreviewPane } from "./ChordProPreviewPane";
import type { ArrangementRow } from "@/lib/db/types";

const initialState: FormState = {};

export function ArrangementEditorForm({
  songId,
  arrangement,
}: {
  songId: string;
  arrangement: ArrangementRow;
}) {
  const [mode, setMode] = useState<"view" | "edit">("view");
  const boundAction = saveArrangementAction.bind(null, songId, arrangement.id);
  const [state, formAction, pending] = useActionState(boundAction, initialState);

  if (mode === "view") {
    return (
      <div className="flex flex-col gap-4">
        <button
          type="button"
          onClick={() => setMode("edit")}
          className="w-fit rounded bg-primary px-4 py-2 text-sm text-primary-foreground"
        >
          Edit
        </button>
        <ChordProPreviewPane text={arrangement.chordpro_body} size="lg" />
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Arrangement name
          <input
            name="name"
            defaultValue={arrangement.name}
            className="w-48 rounded border border-input bg-transparent px-3 py-1.5"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          BPM
          <input
            name="bpm"
            type="number"
            min={1}
            max={999}
            step={1}
            defaultValue={arrangement.bpm ?? ""}
            className="w-24 rounded border border-input bg-transparent px-3 py-1.5"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Time signature
          <input
            name="timeSignature"
            defaultValue={arrangement.time_signature ?? ""}
            placeholder="4/4"
            className="w-24 rounded border border-input bg-transparent px-3 py-1.5"
          />
        </label>
      </div>

      <ChordProTextField name="chordproBody" defaultValue={arrangement.chordpro_body} rows={20} />

      {state.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="w-fit rounded bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setMode("view")}
          className="w-fit rounded border border-border px-4 py-2 text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
