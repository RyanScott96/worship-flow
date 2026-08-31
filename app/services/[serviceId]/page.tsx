import Link from "next/link";
import { notFound } from "next/navigation";
import {
  moveServiceItemAction,
  removeServiceItemAction,
} from "@/app/services/actions";
import { listArrangementOptions } from "@/lib/db/songs";
import { getServiceWithItems } from "@/lib/db/services";
import type { ServiceItemDetail } from "@/lib/db/types";
import { AddServiceItemForm } from "@/components/AddServiceItemForm";
import { ServiceItemEditor } from "@/components/ServiceItemEditor";
import { ServiceSongChart } from "@/components/ServiceSongChart";
import { VerificationBadge } from "@/components/VerificationBadge";

const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

const TYPE_LABEL: Record<string, string> = {
  prayer: "Prayer",
  sermon: "Sermon",
  announcement: "Announcement",
  other: "Item",
};

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

function SongItem({ item }: { item: ServiceItemDetail }) {
  const effectiveKey = item.key_override ?? item.source_key;
  const transposed =
    item.key_override && item.key_override !== item.source_key;
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/songs/${item.song_id}/arrangements/${item.arrangement_id}`}
          className="font-medium hover:underline"
        >
          {item.song_title}
        </Link>
        <span className="text-sm text-black/60 dark:text-white/60">
          {item.arrangement_name}
        </span>
        {item.review_status && <VerificationBadge status={item.review_status} />}
        <span className="ml-auto text-sm">
          <span className="font-mono">{effectiveKey}</span>
          {transposed && (
            <span className="text-black/50 dark:text-white/50">
              {" "}
              (written in {item.source_key})
            </span>
          )}
        </span>
      </div>
      {item.notes && (
        <p className="text-sm text-black/60 dark:text-white/60">{item.notes}</p>
      )}
      {item.chordpro_body && (
        <ServiceSongChart
          chordproBody={item.chordpro_body}
          keyOverride={item.key_override}
          capo={item.capo}
        />
      )}
    </>
  );
}

export default async function ServicePage({
  params,
  searchParams,
}: {
  params: Promise<{ serviceId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { serviceId } = await params;
  const { error } = await searchParams;
  const [result, options] = await Promise.all([
    getServiceWithItems(serviceId),
    listArrangementOptions(),
  ]);
  if (!result) notFound();
  const { service, items } = result;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{service.name}</h1>
          <p className="text-sm text-black/60 dark:text-white/60">
            {fmtWhen(service.starts_at)}
          </p>
        </div>
        <div className="flex gap-3 text-sm">
          <Link href={`/services/${serviceId}/print`} className="underline">
            Print
          </Link>
          <Link href={`/services/${serviceId}/edit`} className="underline">
            Edit
          </Link>
          <Link
            href={`/services/${serviceId}/delete`}
            className="text-red-600 underline dark:text-red-400"
          >
            Delete
          </Link>
        </div>
      </div>

      {service.notes && (
        <p className="whitespace-pre-wrap text-sm text-black/70 dark:text-white/70">
          {service.notes}
        </p>
      )}

      {error && (
        <p className="rounded border border-red-600/30 bg-red-600/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-black/60 dark:text-white/60">
          Nothing in this service yet — add a song below.
        </p>
      ) : (
        <ol className="flex flex-col gap-4">
          {items.map((item, i) => (
            <li
              key={item.id}
              className="flex flex-col gap-2 rounded border border-black/10 p-4 dark:border-white/15"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm text-black/40 dark:text-white/40">
                  {i + 1}
                </span>
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
                    disabled={i === items.length - 1}
                  />
                </div>
                {item.item_type !== "song" && (
                  <span className="text-xs uppercase tracking-wide text-black/50 dark:text-white/50">
                    {TYPE_LABEL[item.item_type] ?? "Item"}
                  </span>
                )}
                <form
                  action={removeServiceItemAction.bind(null, serviceId, item.id)}
                  className="ml-auto"
                >
                  <button
                    type="submit"
                    className="text-sm text-red-600 hover:underline dark:text-red-400"
                  >
                    Remove
                  </button>
                </form>
              </div>

              {item.item_type === "song" ? (
                <SongItem item={item} />
              ) : (
                <div className="flex flex-col gap-1">
                  <span className="font-medium">{item.title}</span>
                  {item.notes && (
                    <p className="text-sm text-black/60 dark:text-white/60">
                      {item.notes}
                    </p>
                  )}
                </div>
              )}

              <ServiceItemEditor serviceId={serviceId} item={item} />
            </li>
          ))}
        </ol>
      )}

      <AddServiceItemForm serviceId={serviceId} options={options} />
    </div>
  );
}
