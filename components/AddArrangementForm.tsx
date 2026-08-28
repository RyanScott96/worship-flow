"use client";

import { useActionState } from "react";
import { createArrangementAction, type FormState } from "@/app/songs/actions";
import { ChordProTextField } from "./ChordProTextField";

const initialState: FormState = {};

export function AddArrangementForm({ songId }: { songId: string }) {
  const boundAction = createArrangementAction.bind(null, songId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);

  return (
    <details className="rounded border border-black/10 p-4 dark:border-white/15">
      <summary className="cursor-pointer text-sm font-medium">Add another arrangement</summary>
      <form action={formAction} className="mt-4 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Arrangement name
          <input
            name="name"
            placeholder="e.g. Capo version, Acoustic"
            className="w-64 rounded border border-black/15 bg-transparent px-3 py-1.5 dark:border-white/20"
          />
        </label>
        <ChordProTextField name="chordproBody" rows={12} />
        {state.error && (
          <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="w-fit rounded bg-foreground px-4 py-2 text-sm text-background disabled:opacity-50"
        >
          {pending ? "Saving…" : "Add arrangement"}
        </button>
      </form>
    </details>
  );
}
