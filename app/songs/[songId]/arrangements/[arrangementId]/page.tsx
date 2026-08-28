import Link from "next/link";
import { notFound } from "next/navigation";
import { getArrangement } from "@/lib/db/arrangements";
import { ArrangementEditorForm } from "@/components/ArrangementEditorForm";

export default async function ArrangementPage({
  params,
}: {
  params: Promise<{ songId: string; arrangementId: string }>;
}) {
  const { songId, arrangementId } = await params;
  const arrangement = await getArrangement(arrangementId);
  if (!arrangement || arrangement.song_id !== songId) notFound();

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-black/60 dark:text-white/60">
            <Link href={`/songs/${songId}`} className="hover:underline">
              {arrangement.song_title}
            </Link>
          </p>
          <h1 className="text-2xl font-semibold">{arrangement.name}</h1>
        </div>
        <div className="flex gap-3 text-sm">
          <a
            href={`/songs/${songId}/arrangements/${arrangementId}/export`}
            className="underline"
          >
            Export .pro
          </a>
          <Link
            href={`/songs/${songId}/arrangements/${arrangementId}/delete`}
            className="text-red-600 underline dark:text-red-400"
          >
            Delete
          </Link>
        </div>
      </div>

      <ArrangementEditorForm songId={songId} arrangement={arrangement} />
    </div>
  );
}
