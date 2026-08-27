import { NextResponse } from "next/server";
import { getArrangement } from "@/lib/db/arrangements";

function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "song"
  );
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ songId: string; arrangementId: string }> },
) {
  const { songId, arrangementId } = await params;
  const arrangement = await getArrangement(arrangementId);
  if (!arrangement || arrangement.song_id !== songId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const filename = `${slugify(arrangement.song_title)}.pro`;

  return new NextResponse(arrangement.chordpro_body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
