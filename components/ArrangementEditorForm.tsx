"use client";

import { useActionState } from "react";
import { saveArrangementAction, type FormState } from "@/app/songs/actions";
import { ChordProTextField } from "./ChordProTextField";
import type { ArrangementRow } from "@/lib/db/types";

const initialState: FormState = {};

export function ArrangementEditorForm({
  songId,
  arrangement,
}: {
  songId: string;
  arrangement: ArrangementRow;
}) {
  const boundAction = saveArrangementAction.bind(null, songId, arrangement.id);
  const [state, formAction, pending] = useActionState(boundAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Arrangement name
          <input
            name="name"
            defaultValue={arrangement.name}
            className="w-48 rounded border border-black/15 bg-transparent px-3 py-1.5 dark:border-white/20"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          BPM
          <input
            name="bpm"
            type="number"
            defaultValue={arrangement.bpm ?? ""}
            className="w-24 rounded border border-black/15 bg-transparent px-3 py-1.5 dark:border-white/20"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Time signature
          <input
            name="timeSignature"
            defaultValue={arrangement.time_signature ?? ""}
            placeholder="4/4"
            className="w-24 rounded border border-black/15 bg-transparent px-3 py-1.5 dark:border-white/20"
          />
        </label>
      </div>

      <ChordProTextField name="chordproBody" defaultValue={arrangement.chordpro_body} rows={20} />

      {state.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded bg-foreground px-4 py-2 text-sm text-background disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
