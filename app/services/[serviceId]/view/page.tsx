import { notFound } from "next/navigation";
import { getServiceWithItems } from "@/lib/db/services";
import { SetlistViewer } from "@/components/SetlistViewer";

/**
 * The tablet chart viewer (ROADMAP Phase 3, D-17): one setlist item at a time,
 * full-bleed. `?i=<index>` picks the starting item so a refresh or a shared link
 * lands in the same place.
 */
export default async function ViewServicePage({
  params,
  searchParams,
}: {
  params: Promise<{ serviceId: string }>;
  searchParams: Promise<{ i?: string }>;
}) {
  const { serviceId } = await params;
  const start = Number((await searchParams).i);
  const result = await getServiceWithItems(serviceId);
  if (!result) notFound();

  return (
    <SetlistViewer
      service={result.service}
      items={result.items}
      startIndex={Number.isInteger(start) && start >= 0 ? start : 0}
    />
  );
}
