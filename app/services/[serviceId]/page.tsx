import Link from "next/link";
import { notFound } from "next/navigation";
import { listArrangementOptions } from "@/lib/db/songs";
import { getServiceWithItems } from "@/lib/db/services";
import { type ServiceItemDetail } from "@/lib/db/types";
import { capoIsSet } from "@/lib/transpose";
import { CapoChartToggle } from "@/components/CapoChartToggle";
import { ServiceDetail, type ServiceItemRow } from "@/components/ServiceDetail";
import { ServiceSongChart } from "@/components/ServiceSongChart";
import { VerificationBadge } from "@/components/VerificationBadge";

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
      {item.chordpro_body &&
        (capoIsSet(item.capo) ? (
          <CapoChartToggle
            capo={item.capo}
            soundingChart={
              <ServiceSongChart
                chordproBody={item.chordpro_body}
                keyOverride={item.key_override}
                capo={item.capo}
                mode="sounding"
              />
            }
            capoChart={
              <ServiceSongChart
                chordproBody={item.chordpro_body}
                keyOverride={item.key_override}
                capo={item.capo}
                mode="capo"
              />
            }
          />
        ) : (
          <ServiceSongChart
            chordproBody={item.chordpro_body}
            keyOverride={item.key_override}
            capo={item.capo}
          />
        ))}
    </>
  );
}

function NonSongItem({ item }: { item: ServiceItemDetail }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-medium">{item.title}</span>
      {item.notes && (
        <p className="text-sm text-black/60 dark:text-white/60">{item.notes}</p>
      )}
    </div>
  );
}

export default async function ServicePage({
  params,
}: {
  params: Promise<{ serviceId: string }>;
}) {
  const { serviceId } = await params;
  const [result, options] = await Promise.all([
    getServiceWithItems(serviceId),
    listArrangementOptions(),
  ]);
  if (!result) notFound();
  const { service, items } = result;

  const rows: ServiceItemRow[] = items.map((item) => ({
    item,
    display:
      item.item_type === "song" ? (
        <SongItem item={item} />
      ) : (
        <NonSongItem item={item} />
      ),
  }));

  return (
    <ServiceDetail
      serviceId={serviceId}
      service={service}
      rows={rows}
      options={options}
    />
  );
}
