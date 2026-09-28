"use client";

import { useActionState } from "react";
import { updateServiceItemAction, type FormState } from "@/app/services/actions";
import type { ServiceItemDetail } from "@/lib/db/types";

const initialState: FormState = {};

const fieldClass =
  "rounded border border-border bg-transparent px-2 py-1 text-sm";

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
      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
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
          className="rounded bg-primary px-3 py-1 text-sm text-primary-foreground disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {state.error && (
          <p className="w-full text-destructive">{state.error}</p>
        )}
      </form>
    </details>
  );
}
