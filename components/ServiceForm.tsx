"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/services/actions";
import { instantToWallClock } from "@/lib/church-time";
import type { ServiceRow } from "@/lib/db/types";

const initialState: FormState = {};

export function ServiceForm({
  action,
  service,
  submitLabel,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  service?: ServiceRow;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        Name
        <input
          name="name"
          required
          defaultValue={service?.name}
          placeholder="e.g. Sunday AM, Good Friday"
          className="rounded border border-black/15 bg-transparent px-3 py-1.5 dark:border-white/20"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Date &amp; time
        <input
          name="startsAt"
          type="datetime-local"
          required
          defaultValue={service ? instantToWallClock(service.starts_at) : undefined}
          className="w-64 rounded border border-black/15 bg-transparent px-3 py-1.5 dark:border-white/20"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Notes
        <textarea
          name="notes"
          rows={2}
          defaultValue={service?.notes ?? ""}
          className="rounded border border-black/15 bg-transparent px-3 py-1.5 dark:border-white/20"
        />
      </label>

      {state.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded bg-foreground px-4 py-2 text-sm text-background disabled:opacity-50"
      >
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
