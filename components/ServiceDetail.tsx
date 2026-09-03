"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import {
  moveServiceItemAction,
  removeServiceItemAction,
  updateServiceAction,
} from "@/app/services/actions";
import { formatServiceWhen } from "@/lib/church-time";
import {
  SERVICE_ITEM_TYPE_LABEL,
  type ServiceItemDetail,
  type ServiceRow,
} from "@/lib/db/types";
import type { SongArrangementOption } from "@/lib/db/songs";
import { AddServiceItemForm } from "@/components/AddServiceItemForm";
import { ServiceForm } from "@/components/ServiceForm";
import { ServiceItemEditor } from "@/components/ServiceItemEditor";

export interface ServiceItemRow {
  item: ServiceItemDetail;
  /** Read-only body, rendered on the server; identical in both modes. */
  display: ReactNode;
}

function MoveButton({
  serviceId,
  itemId,
  direction,
  disabled,
}: {
  serviceId: string;
  itemId: string;
  direction: "up" | "down";
  disabled: boolean;
}) {
  const action = moveServiceItemAction.bind(null, serviceId, itemId, direction);
  return (
    <form action={action}>
      <button
        type="submit"
        disabled={disabled}
        aria-label={`Move ${direction}`}
        className="rounded border border-black/15 px-1.5 text-sm leading-none disabled:opacity-30 dark:border-white/20"
      >
        {direction === "up" ? "↑" : "↓"}
      </button>
    </form>
  );
}

export function ServiceDetail({
  serviceId,
  service,
  rows,
  options,
}: {
  serviceId: string;
  service: ServiceRow;
  rows: ServiceItemRow[];
  options: SongArrangementOption[];
}) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{service.name}</h1>
          <p className="text-sm text-black/60 dark:text-white/60">
            {formatServiceWhen(service.starts_at)}
          </p>
        </div>
        <div className="flex gap-3 text-sm">
          <Link href={`/services/${serviceId}/view`} className="underline">
            Open viewer
          </Link>
          <Link href={`/services/${serviceId}/print`} className="underline">
            Print
          </Link>
          <button
            type="button"
            onClick={() => setEditing((e) => !e)}
            className="underline"
          >
            {editing ? "Done" : "Edit"}
          </button>
          <Link
            href={`/services/${serviceId}/delete`}
            className="text-red-600 underline dark:text-red-400"
          >
            Delete
          </Link>
        </div>
      </div>

      {editing ? (
        <ServiceForm
          action={updateServiceAction.bind(null, serviceId)}
          service={service}
          submitLabel="Save changes"
        />
      ) : (
        service.notes && (
          <p className="whitespace-pre-wrap text-sm text-black/70 dark:text-white/70">
            {service.notes}
          </p>
        )
      )}

      {rows.length === 0 ? (
        <p className="text-sm text-black/60 dark:text-white/60">
          {editing
            ? "Nothing in this service yet — add a song below."
            : "Nothing in this service yet."}
        </p>
      ) : (
        <ol className="flex flex-col gap-4">
          {rows.map(({ item, display }, i) => (
            <li
              key={item.id}
              className="flex flex-col gap-2 rounded border border-black/10 p-4 dark:border-white/15"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm text-black/40 dark:text-white/40">
                  {i + 1}
                </span>
                {editing && (
                  <div className="flex gap-1">
                    <MoveButton
                      serviceId={serviceId}
                      itemId={item.id}
                      direction="up"
                      disabled={i === 0}
                    />
                    <MoveButton
                      serviceId={serviceId}
                      itemId={item.id}
                      direction="down"
                      disabled={i === rows.length - 1}
                    />
                  </div>
                )}
                {item.item_type !== "song" && (
                  <span className="text-xs uppercase tracking-wide text-black/50 dark:text-white/50">
                    {SERVICE_ITEM_TYPE_LABEL[item.item_type]}
                  </span>
                )}
                {editing && (
                  <form
                    action={removeServiceItemAction.bind(
                      null,
                      serviceId,
                      item.id,
                    )}
                    className="ml-auto"
                  >
                    <button
                      type="submit"
                      className="text-sm text-red-600 hover:underline dark:text-red-400"
                    >
                      Remove
                    </button>
                  </form>
                )}
              </div>

              {display}

              {editing && (
                <ServiceItemEditor serviceId={serviceId} item={item} />
              )}
            </li>
          ))}
        </ol>
      )}

      {editing && (
        <AddServiceItemForm serviceId={serviceId} options={options} />
      )}
    </div>
  );
}
