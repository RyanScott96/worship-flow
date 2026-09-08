import { notFound } from "next/navigation";
import { getArrangement } from "@/lib/db/arrangements";
import { ArrangementViewer } from "@/components/ArrangementViewer";
import { clampCapo } from "@/components/ChartControls";

/**
 * The single-arrangement tablet viewer (ROADMAP Phase 3): full-bleed chart for
 * one arrangement with key / capo / render-mode controls. `?key=` and `?capo=`
 * seed those controls; the viewer keeps them in the URL so a reload holds place.
 */
export default async function ViewArrangementPage({
  params,
  searchParams,
}: {
  params: Promise<{ songId: string; arrangementId: string }>;
  searchParams: Promise<{ key?: string; capo?: string }>;
}) {
  const { songId, arrangementId } = await params;
  const { key, capo } = await searchParams;
  const arrangement = await getArrangement(arrangementId);
  if (!arrangement || arrangement.song_id !== songId) notFound();

  return (
    <ArrangementViewer
      songId={songId}
      arrangement={arrangement}
      initialKey={key ?? ""}
      initialCapo={capo === undefined ? 0 : clampCapo(capo)}
    />
  );
}
