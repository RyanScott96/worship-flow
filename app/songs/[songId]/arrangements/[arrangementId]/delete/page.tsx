import Link from "next/link";
import { notFound } from "next/navigation";
import { getArrangement } from "@/lib/db/arrangements";
import { deleteArrangementAction } from "@/app/songs/actions";

export default async function DeleteArrangementPage({
  params,
  searchParams,
}: {
  params: Promise<{ songId: string; arrangementId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { songId, arrangementId } = await params;
  const { error } = await searchParams;
  const arrangement = await getArrangement(arrangementId);
  if (!arrangement || arrangement.song_id !== songId) notFound();

  const action = deleteArrangementAction.bind(null, songId, arrangementId);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <h1 className="text-2xl font-semibold">
        Delete &ldquo;{arrangement.name}&rdquo;?
      </h1>
      <p className="text-sm text-foreground/80">
        This permanently deletes this arrangement of {arrangement.song_title} and its
        revision history. This cannot be undone.
      </p>
      {error && (
        <p className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <form action={action} className="flex gap-3">
        <button type="submit" className="rounded bg-destructive px-4 py-2 text-sm text-destructive-foreground">
          Delete permanently
        </button>
        <Link
          href={`/songs/${songId}/arrangements/${arrangementId}`}
          className="rounded border border-border px-4 py-2 text-sm"
        >
          Cancel
        </Link>
      </form>
    </div>
  );
}
