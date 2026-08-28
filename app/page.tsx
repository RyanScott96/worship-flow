import Link from "next/link";
import { listSongs } from "@/lib/db/songs";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const songs = await listSongs(q);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Song library</h1>
        <Link
          href="/songs/new"
          className="rounded bg-foreground px-3 py-1.5 text-sm text-background"
        >
          New song
        </Link>
      </div>

      <form className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search by title…"
          className="flex-1 rounded border border-black/15 bg-transparent px-3 py-1.5 text-sm dark:border-white/20"
        />
        <button
          type="submit"
          className="rounded border border-black/15 px-3 py-1.5 text-sm dark:border-white/20"
        >
          Search
        </button>
      </form>

      {songs.length === 0 ? (
        <p className="text-sm text-black/60 dark:text-white/60">
          {q ? `No songs match "${q}".` : "No songs yet — add the first one."}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-black/10 dark:divide-white/15">
          {songs.map((song) => (
            <li key={song.id} className="py-3">
              <Link href={`/songs/${song.id}`} className="font-medium hover:underline">
                {song.title}
              </Link>
              {song.authors && (
                <span className="ml-2 text-sm text-black/60 dark:text-white/60">
                  {song.authors}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
