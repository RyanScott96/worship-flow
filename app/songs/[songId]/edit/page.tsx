import { notFound } from "next/navigation";
import { getSongWithArrangements } from "@/lib/db/songs";
import { EditSongForm } from "@/components/EditSongForm";

export default async function EditSongPage({
  params,
}: {
  params: Promise<{ songId: string }>;
}) {
  const { songId } = await params;
  const result = await getSongWithArrangements(songId);
  if (!result) notFound();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Edit {result.song.title}</h1>
      <EditSongForm song={result.song} />
    </div>
  );
}
