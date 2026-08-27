"use client";

import { useActionState } from "react";
import { updateSongAction, type FormState } from "@/app/songs/actions";
import type { SongRow } from "@/lib/db/types";

const initialState: FormState = {};

export function EditSongForm({ song }: { song: SongRow }) {
  const boundAction = updateSongAction.bind(null, song.id);
  const [state, formAction, pending] = useActionState(boundAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          Title
          <input
            name="title"
            required
            defaultValue={song.title}
            className="rounded border border-black/15 bg-transparent px-3 py-1.5 dark:border-white/20"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Author(s)
          <input
            name="authors"
            defaultValue={song.authors ?? ""}
            className="rounded border border-black/15 bg-transparent px-3 py-1.5 dark:border-white/20"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          CCLI number
          <input
            name="ccliNumber"
            defaultValue={song.ccli_number ?? ""}
            className="rounded border border-black/15 bg-transparent px-3 py-1.5 dark:border-white/20"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Copyright
          <input
            name="copyright"
            defaultValue={song.copyright ?? ""}
            className="rounded border border-black/15 bg-transparent px-3 py-1.5 dark:border-white/20"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Default key (hint only)
          <input
            name="defaultKey"
            defaultValue={song.default_key ?? ""}
            className="rounded border border-black/15 bg-transparent px-3 py-1.5 dark:border-white/20"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          Notes
          <textarea
            name="notes"
            rows={3}
            defaultValue={song.notes ?? ""}
            className="rounded border border-black/15 bg-transparent px-3 py-1.5 dark:border-white/20"
          />
        </label>
      </div>

      {state.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded bg-foreground px-4 py-2 text-sm text-background disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
