import Link from "next/link";
import { notFound } from "next/navigation";
import { getSongWithArrangements } from "@/lib/db/songs";
import { AddArrangementForm } from "@/components/AddArrangementForm";

const REVIEW_LABEL: Record<string, string> = {
  unverified: "Unverified",
  verified: "Verified",
  flagged: "Flagged",
};

export default async function SongPage({
  params,
}: {
  params: Promise<{ songId: string }>;
}) {
  const { songId } = await params;
  const result = await getSongWithArrangements(songId);
  if (!result) notFound();
  const { song, arrangements } = result;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{song.title}</h1>
          {song.authors && (
            <p className="text-sm text-black/60 dark:text-white/60">{song.authors}</p>
          )}
        </div>
        <div className="flex gap-3 text-sm">
          <Link href={`/songs/${song.id}/edit`} className="underline">
            Edit
          </Link>
          <Link href={`/songs/${song.id}/delete`} className="text-red-600 underline dark:text-red-400">
            Delete
          </Link>
        </div>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        {song.ccli_number && (
          <>
            <dt className="text-black/60 dark:text-white/60">CCLI #</dt>
            <dd>{song.ccli_number}</dd>
          </>
        )}
        {song.copyright && (
          <>
            <dt className="text-black/60 dark:text-white/60">Copyright</dt>
            <dd>{song.copyright}</dd>
          </>
        )}
        {song.default_key && (
          <>
            <dt className="text-black/60 dark:text-white/60">Default key</dt>
            <dd>{song.default_key}</dd>
          </>
        )}
        {song.notes && (
          <>
            <dt className="text-black/60 dark:text-white/60">Notes</dt>
            <dd className="whitespace-pre-wrap">{song.notes}</dd>
          </>
        )}
      </dl>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Arrangements</h2>
        <ul className="flex flex-col divide-y divide-black/10 dark:divide-white/15">
          {arrangements.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-4 py-3">
              <Link
                href={`/songs/${song.id}/arrangements/${a.id}`}
                className="font-medium hover:underline"
              >
                {a.name} · {a.source_key}
              </Link>
              <span className="text-xs text-black/60 dark:text-white/60">
                {REVIEW_LABEL[a.review_status] ?? a.review_status}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <AddArrangementForm songId={song.id} />
    </div>
  );
}
