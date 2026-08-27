import Link from "next/link";
import { notFound } from "next/navigation";
import { getSongWithArrangements } from "@/lib/db/songs";
import { deleteSongAction } from "@/app/songs/actions";

export default async function DeleteSongPage({
  params,
}: {
  params: Promise<{ songId: string }>;
}) {
  const { songId } = await params;
  const result = await getSongWithArrangements(songId);
  if (!result) notFound();
  const { song, arrangements } = result;

  const action = deleteSongAction.bind(null, songId);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <h1 className="text-2xl font-semibold">Delete &ldquo;{song.title}&rdquo;?</h1>
      <p className="text-sm text-black/70 dark:text-white/70">
        This permanently deletes the song and{" "}
        {arrangements.length === 1
          ? "its 1 arrangement"
          : `all ${arrangements.length} of its arrangements`}
        . This cannot be undone.
      </p>
      <form action={action} className="flex gap-3">
        <button
          type="submit"
          className="rounded bg-red-600 px-4 py-2 text-sm text-white"
        >
          Delete permanently
        </button>
        <Link
          href={`/songs/${songId}`}
          className="rounded border border-black/15 px-4 py-2 text-sm dark:border-white/20"
        >
          Cancel
        </Link>
      </form>
    </div>
  );
}
