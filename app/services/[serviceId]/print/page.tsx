import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatServiceWhen } from "@/lib/church-time";
import { getServiceWithItems } from "@/lib/db/services";
import {
  SERVICE_ITEM_TYPE_LABEL,
  type ServiceItemDetail,
} from "@/lib/db/types";
import { PrintButton } from "@/components/PrintButton";
import { ServiceSongChart } from "@/components/ServiceSongChart";

type PrintMode = "chords" | "lyrics";

function hasCapo(item: ServiceItemDetail): boolean {
  return item.capo != null && item.capo > 0;
}

/** The key this song sounds in for this service, noting the source key if transposed. */
function keyLabel(item: ServiceItemDetail): string | null {
  const effective = item.key_override ?? item.source_key;
  if (!effective) return null;
  const transposed =
    item.key_override && item.key_override !== item.source_key;
  return transposed ? `${effective} (from ${item.source_key})` : effective;
}

/** 270 -> "4:30" */
function formatClock(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Sum of the durations that are set, rendered as "~23 min". Null if none are set. */
function totalRuntime(items: ServiceItemDetail[]): string | null {
  const secs = items.reduce((sum, it) => sum + (it.duration_secs ?? 0), 0);
  if (secs === 0) return null;
  return `~${Math.round(secs / 60)} min`;
}

/**
 * One printed page: a heading and a single chart. A capo song is rendered
 * twice — a "key" page and a "capo N" page — so the rhythm player and the
 * capo player each have a page to keep and can skip the other.
 */
function ChartPage({
  n,
  item,
  variant,
}: {
  n: number;
  item: ServiceItemDetail;
  variant: "sounding" | "capo" | "lyrics";
}) {
  const key = keyLabel(item);
  const suffix =
    variant === "capo"
      ? `— capo ${item.capo}`
      : variant === "sounding" && hasCapo(item)
        ? "— key"
        : null;
  return (
    <section data-print-song className="flex flex-col gap-2">
      <h2 className="text-lg font-medium">
        <span className="text-black/40 dark:text-white/40">{n}. </span>
        {item.song_title}
        {suffix && (
          <span className="ml-1 font-normal text-black/50 dark:text-white/50">
            {suffix}
          </span>
        )}
        <span className="ml-2 text-sm font-normal text-black/60 dark:text-white/60">
          {item.arrangement_name}
          {variant !== "lyrics" && key && (
            <>
              {" · "}
              <span className="font-mono">{key}</span>
            </>
          )}
        </span>
      </h2>
      {item.notes && (
        <p className="text-sm text-black/70 dark:text-white/70">{item.notes}</p>
      )}
      {item.chordpro_body && (
        <ServiceSongChart
          chordproBody={item.chordpro_body}
          keyOverride={item.key_override}
          capo={item.capo}
          mode={variant}
        />
      )}
    </section>
  );
}

export default async function PrintServicePage({
  params,
  searchParams,
}: {
  params: Promise<{ serviceId: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const { serviceId } = await params;
  const mode: PrintMode =
    (await searchParams).mode === "lyrics" ? "lyrics" : "chords";
  const result = await getServiceWithItems(serviceId);
  if (!result) notFound();
  const { service, items } = result;

  const songs = items.filter(
    (it) => it.item_type === "song" && it.chordpro_body,
  );
  const runtime = totalRuntime(items);

  const tabClass = (active: boolean) =>
    active ? "font-semibold underline" : "underline";

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div
        className="flex flex-wrap items-center justify-between gap-3"
        data-print-hide
      >
        <Link href={`/services/${serviceId}`} className="text-sm underline">
          Back to service
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-black/50 dark:text-white/50">Print as</span>
          <Link
            href={`/services/${serviceId}/print`}
            aria-current={mode === "chords" ? "page" : undefined}
            className={tabClass(mode === "chords")}
          >
            Chords + lyrics
          </Link>
          <Link
            href={`/services/${serviceId}/print?mode=lyrics`}
            aria-current={mode === "lyrics" ? "page" : undefined}
            className={tabClass(mode === "lyrics")}
          >
            Lyrics only
          </Link>
          <PrintButton />
        </div>
      </div>

      <header className="flex flex-col gap-1 border-b border-black/20 pb-2">
        <h1 className="text-2xl font-semibold">{service.name}</h1>
        <p className="text-sm text-black/60 dark:text-white/60">
          {formatServiceWhen(service.starts_at)}
          {mode === "lyrics" ? " · lyrics only" : ""}
        </p>
      </header>

      {/* Page 1: the running order. */}
      <section data-print-summary className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-medium">Order of service</h2>
          {runtime && (
            <span className="text-sm text-black/60 dark:text-white/60">
              {runtime}
            </span>
          )}
        </div>
        {items.length === 0 ? (
          <p className="text-sm text-black/60 dark:text-white/60">
            Nothing in this service yet.
          </p>
        ) : (
          <ol className="flex flex-col gap-1.5 text-sm">
            {items.map((item, i) => {
              const key = keyLabel(item);
              return (
                <li key={item.id} className="flex flex-col gap-0.5">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-black/40 dark:text-white/40">
                      {i + 1}.
                    </span>
                    <span className="font-medium">
                      {item.item_type === "song" ? item.song_title : item.title}
                    </span>
                    {item.item_type === "song" ? (
                      <span className="text-black/60 dark:text-white/60">
                        {item.arrangement_name}
                        {key && (
                          <>
                            {" · "}
                            <span className="font-mono">{key}</span>
                          </>
                        )}
                        {hasCapo(item) ? ` · capo ${item.capo}` : ""}
                      </span>
                    ) : (
                      <span className="uppercase tracking-wide text-black/50 dark:text-white/50">
                        {SERVICE_ITEM_TYPE_LABEL[item.item_type]}
                      </span>
                    )}
                    {item.duration_secs != null && (
                      <span className="ml-auto tabular-nums text-black/50 dark:text-white/50">
                        {formatClock(item.duration_secs)}
                      </span>
                    )}
                  </div>
                  {item.notes && (
                    <p className="pl-5 text-black/60 dark:text-white/60">
                      {item.notes}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {/* One chart per page. A capo song prints twice: key, then capo. */}
      <div className="print-charts flex flex-col gap-6">
        {songs.map((item) => {
          const n = items.indexOf(item) + 1;
          if (mode === "lyrics") {
            return (
              <ChartPage key={item.id} n={n} item={item} variant="lyrics" />
            );
          }
          return (
            <Fragment key={item.id}>
              <ChartPage n={n} item={item} variant="sounding" />
              {hasCapo(item) && (
                <ChartPage n={n} item={item} variant="capo" />
              )}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
