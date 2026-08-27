import { NewSongForm } from "@/components/NewSongForm";

export default function NewSongPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">New song</h1>
      <NewSongForm />
    </div>
  );
}
