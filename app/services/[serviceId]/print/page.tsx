import Link from "next/link";
import { notFound } from "next/navigation";
import { formatServiceWhen } from "@/lib/church-time";
import { getServiceWithItems } from "@/lib/db/services";
import { SERVICE_ITEM_TYPE_LABEL } from "@/lib/db/types";
import { PrintButton } from "@/components/PrintButton";
import { ServiceSongChart } from "@/components/ServiceSongChart";

export default async function PrintServicePage({
  params,
}: {
  params: Promise<{ serviceId: string }>;
}) {
  const { serviceId } = await params;
  const result = await getServiceWithItems(serviceId);
  if (!result) notFound();
  const { service, items } = result;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex items-start justify-between gap-4" data-print-hide>
        <Link href={`/services/${serviceId}`} className="text-sm underline">
          Back to service
        </Link>
        <PrintButton />
      </div>

      <header className="flex flex-col gap-1 border-b border-black/20 pb-2">
        <h1 className="text-2xl font-semibold">{service.name}</h1>
        <p className="text-sm text-black/60 dark:text-white/60">
          {formatServiceWhen(service.starts_at)}
        </p>
      </header>

      {items.map((item, i) => (
        <section key={item.id} data-print-song className="flex flex-col gap-2">
          <h2 className="text-lg font-medium">
            <span className="text-black/40 dark:text-white/40">{i + 1}. </span>
            {item.item_type === "song" ? (
              <>
                {item.song_title}
                <span className="ml-2 text-sm font-normal text-black/60 dark:text-white/60">
                  {item.arrangement_name} ·{" "}
                  <span className="font-mono">
                    {item.key_override ?? item.source_key}
                  </span>
                </span>
              </>
            ) : (
              <>
                {item.title}
                <span className="ml-2 text-sm font-normal uppercase tracking-wide text-black/50 dark:text-white/50">
                  {SERVICE_ITEM_TYPE_LABEL[item.item_type]}
                </span>
              </>
            )}
          </h2>
          {item.notes && (
            <p className="text-sm text-black/70 dark:text-white/70">{item.notes}</p>
          )}
          {item.item_type === "song" && item.chordpro_body && (
            <ServiceSongChart
              chordproBody={item.chordpro_body}
              keyOverride={item.key_override}
              capo={item.capo}
            />
          )}
        </section>
      ))}
    </div>
  );
}
