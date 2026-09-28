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
          className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground"
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
          className="flex-1 rounded border border-input bg-transparent px-3 py-1.5 text-sm"
        />
        <button
          type="submit"
          className="rounded border border-input px-3 py-1.5 text-sm"
        >
          Search
        </button>
      </form>

      {songs.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {q ? `No songs match "${q}".` : "No songs yet — add the first one."}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {songs.map((song) => (
            <li key={song.id} className="py-3">
              <Link href={`/songs/${song.id}`} className="font-medium hover:underline">
                {song.title}
              </Link>
              {song.authors && (
                <span className="ml-2 text-sm text-muted-foreground">
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
