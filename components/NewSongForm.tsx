"use client";

import { useActionState } from "react";
import { createSongAction, type FormState } from "@/app/songs/actions";
import { ChordProTextField } from "./ChordProTextField";

const initialState: FormState = {};

export function NewSongForm() {
  const [state, formAction, pending] = useActionState(createSongAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          Title
          <input
            name="title"
            required
            className="rounded border border-black/15 bg-transparent px-3 py-1.5 dark:border-white/20"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Author(s)
          <input
            name="authors"
            className="rounded border border-black/15 bg-transparent px-3 py-1.5 dark:border-white/20"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          CCLI number
          <input
            name="ccliNumber"
            className="rounded border border-black/15 bg-transparent px-3 py-1.5 dark:border-white/20"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Copyright
          <input
            name="copyright"
            className="rounded border border-black/15 bg-transparent px-3 py-1.5 dark:border-white/20"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Default key (hint only)
          <input
            name="defaultKey"
            className="rounded border border-black/15 bg-transparent px-3 py-1.5 dark:border-white/20"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          Notes
          <textarea
            name="notes"
            rows={2}
            className="rounded border border-black/15 bg-transparent px-3 py-1.5 dark:border-white/20"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Arrangement name
        <input
          name="arrangementName"
          defaultValue="Default"
          className="w-48 rounded border border-black/15 bg-transparent px-3 py-1.5 dark:border-white/20"
        />
      </label>

      <div className="flex flex-col gap-1 text-sm">
        <span>
          Chart (ChordPro — paste as-is, plain lyrics are fine too. Must include a{" "}
          <code>{"{key: ...}"}</code> line.)
        </span>
        <ChordProTextField name="chordproBody" />
      </div>

      {state.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded bg-foreground px-4 py-2 text-sm text-background disabled:opacity-50"
      >
        {pending ? "Saving…" : "Create song"}
      </button>
    </form>
  );
}
