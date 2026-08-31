"use client";

import { useActionState } from "react";
import {
  addNonSongItemAction,
  addSongItemAction,
  type FormState,
} from "@/app/services/actions";
import type { SongArrangementOption } from "@/lib/db/songs";

const initialState: FormState = {};

const fieldClass =
  "rounded border border-black/15 bg-transparent px-3 py-1.5 text-sm dark:border-white/20";

function SongForm({
  serviceId,
  options,
}: {
  serviceId: string;
  options: SongArrangementOption[];
}) {
  const action = addSongItemAction.bind(null, serviceId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="mt-3 flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Song / arrangement
        <select name="arrangementId" required className={`w-72 ${fieldClass}`}>
          <option value="">Choose…</option>
          {options.map((o) => (
            <option key={o.arrangement_id} value={o.arrangement_id}>
              {o.song_title} — {o.arrangement_name} ({o.source_key})
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Key
        <input
          name="keyOverride"
          placeholder="as written"
          className={`w-24 ${fieldClass}`}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Capo
        <input
          name="capo"
          type="number"
          min={0}
          max={11}
          className={`w-16 ${fieldClass}`}
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-foreground px-4 py-1.5 text-sm text-background disabled:opacity-50"
      >
        {pending ? "Adding…" : "Add song"}
      </button>
      {state.error && (
        <p className="w-full text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
    </form>
  );
}

function NonSongForm({ serviceId }: { serviceId: string }) {
  const action = addNonSongItemAction.bind(null, serviceId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="mt-3 flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Type
        <select name="itemType" className={`w-40 ${fieldClass}`} defaultValue="prayer">
          <option value="prayer">Prayer</option>
          <option value="sermon">Sermon</option>
          <option value="announcement">Announcement</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label className="flex flex-1 flex-col gap-1 text-sm">
        Title
        <input
          name="title"
          required
          placeholder="e.g. Welcome, Communion, Offering"
          className={`min-w-48 ${fieldClass}`}
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded border border-black/15 px-4 py-1.5 text-sm dark:border-white/20 disabled:opacity-50"
      >
        {pending ? "Adding…" : "Add item"}
      </button>
      {state.error && (
        <p className="w-full text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
    </form>
  );
}

export function AddServiceItemForm({
  serviceId,
  options,
}: {
  serviceId: string;
  options: SongArrangementOption[];
}) {
  return (
    <div className="flex flex-col gap-3 rounded border border-black/10 p-4 dark:border-white/15">
      <p className="text-sm font-medium">Add to this service</p>
      <SongForm serviceId={serviceId} options={options} />
      <details className="text-sm">
        <summary className="cursor-pointer text-black/60 dark:text-white/60">
          Add a non-song item (prayer, sermon, announcement…)
        </summary>
        <NonSongForm serviceId={serviceId} />
      </details>
    </div>
  );
}
