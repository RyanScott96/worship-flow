import Link from "next/link";
import { notFound } from "next/navigation";
import { getArrangement } from "@/lib/db/arrangements";
import { deleteArrangementAction } from "@/app/songs/actions";

export default async function DeleteArrangementPage({
  params,
}: {
  params: Promise<{ songId: string; arrangementId: string }>;
}) {
  const { songId, arrangementId } = await params;
  const arrangement = await getArrangement(arrangementId);
  if (!arrangement || arrangement.song_id !== songId) notFound();

  const action = deleteArrangementAction.bind(null, songId, arrangementId);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <h1 className="text-2xl font-semibold">
        Delete &ldquo;{arrangement.name}&rdquo;?
      </h1>
      <p className="text-sm text-black/70 dark:text-white/70">
        This permanently deletes this arrangement of {arrangement.song_title} and its
        revision history. This cannot be undone.
      </p>
      <form action={action} className="flex gap-3">
        <button type="submit" className="rounded bg-red-600 px-4 py-2 text-sm text-white">
          Delete permanently
        </button>
        <Link
          href={`/songs/${songId}/arrangements/${arrangementId}`}
          className="rounded border border-black/15 px-4 py-2 text-sm dark:border-white/20"
        >
          Cancel
        </Link>
      </form>
    </div>
  );
}
