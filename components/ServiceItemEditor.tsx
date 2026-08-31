"use client";

import { useActionState } from "react";
import { updateServiceItemAction, type FormState } from "@/app/services/actions";
import type { ServiceItemDetail } from "@/lib/db/types";

const initialState: FormState = {};

const fieldClass =
  "rounded border border-black/15 bg-transparent px-2 py-1 text-sm dark:border-white/20";

export function ServiceItemEditor({
  serviceId,
  item,
}: {
  serviceId: string;
  item: ServiceItemDetail;
}) {
  const action = updateServiceItemAction.bind(null, serviceId, item.id);
  const [state, formAction, pending] = useActionState(action, initialState);
  const isSong = item.item_type === "song";

  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white">
        Edit
      </summary>
      <form action={formAction} className="mt-2 flex flex-wrap items-end gap-3">
        {isSong ? (
          <>
            <label className="flex flex-col gap-1">
              Key for this service
              <input
                name="keyOverride"
                defaultValue={item.key_override ?? ""}
                placeholder={item.source_key ?? "e.g. G"}
                className={`w-24 ${fieldClass}`}
              />
            </label>
            <label className="flex flex-col gap-1">
              Capo
              <input
                name="capo"
                type="number"
                min={0}
                max={11}
                defaultValue={item.capo ?? ""}
                className={`w-16 ${fieldClass}`}
              />
            </label>
          </>
        ) : (
          <label className="flex flex-col gap-1">
            Title
            <input
              name="title"
              defaultValue={item.title ?? ""}
              className={`w-64 ${fieldClass}`}
            />
          </label>
        )}
        <label className="flex flex-1 flex-col gap-1">
          Notes
          <input
            name="notes"
            defaultValue={item.notes ?? ""}
            className={`min-w-40 ${fieldClass}`}
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-foreground px-3 py-1 text-sm text-background disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {state.error && (
          <p className="w-full text-red-600 dark:text-red-400">{state.error}</p>
        )}
      </form>
    </details>
  );
}
