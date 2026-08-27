"use server";

import { redirect } from "next/navigation";
import * as songs from "@/lib/db/songs";
import * as arrangements from "@/lib/db/arrangements";
import { ArrangementValidationError } from "@/lib/db/validation";

export interface FormState {
  error?: string;
}

function str(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export async function createSongAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const title = str(formData, "title");
  const chordproBody = str(formData, "chordproBody");
  if (!title) return { error: "Title is required." };
  if (!chordproBody) return { error: "Paste the chart's ChordPro or lyrics." };

  let songId: string;
  try {
    ({ songId } = await songs.createSongWithArrangement({
      title,
      authors: str(formData, "authors"),
      ccliNumber: str(formData, "ccliNumber"),
      copyright: str(formData, "copyright"),
      defaultKey: str(formData, "defaultKey"),
      notes: str(formData, "notes"),
      arrangementName: str(formData, "arrangementName"),
      chordproBody,
    }));
  } catch (err) {
    if (err instanceof ArrangementValidationError) return { error: err.message };
    throw err;
  }

  redirect(`/songs/${songId}`);
}

export async function updateSongAction(
  id: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const title = str(formData, "title");
  if (!title) return { error: "Title is required." };

  await songs.updateSong(id, {
    title,
    authors: str(formData, "authors"),
    ccliNumber: str(formData, "ccliNumber"),
    copyright: str(formData, "copyright"),
    defaultKey: str(formData, "defaultKey"),
    notes: str(formData, "notes"),
  });

  redirect(`/songs/${id}`);
}

export async function deleteSongAction(id: string): Promise<void> {
  await songs.deleteSong(id);
  redirect("/");
}

export async function createArrangementAction(
  songId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const chordproBody = str(formData, "chordproBody");
  if (!chordproBody) return { error: "Paste the chart's ChordPro or lyrics." };

  let arrangementId: string;
  try {
    ({ arrangementId } = await arrangements.createArrangement(songId, {
      name: str(formData, "name"),
      chordproBody,
    }));
  } catch (err) {
    if (err instanceof ArrangementValidationError) return { error: err.message };
    throw err;
  }

  redirect(`/songs/${songId}/arrangements/${arrangementId}`);
}

export async function saveArrangementAction(
  songId: string,
  arrangementId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const chordproBody = str(formData, "chordproBody");
  if (!chordproBody) return { error: "The chart can't be empty." };

  const bpmRaw = str(formData, "bpm");
  const bpm = bpmRaw ? Number(bpmRaw) : undefined;
  if (bpm !== undefined && !Number.isFinite(bpm)) return { error: "BPM must be a number." };

  try {
    await arrangements.updateArrangement(arrangementId, {
      name: str(formData, "name"),
      chordproBody,
      bpm,
      timeSignature: str(formData, "timeSignature"),
    });
  } catch (err) {
    if (err instanceof ArrangementValidationError) return { error: err.message };
    throw err;
  }

  redirect(`/songs/${songId}/arrangements/${arrangementId}`);
}

export async function deleteArrangementAction(
  songId: string,
  arrangementId: string,
): Promise<void> {
  await arrangements.deleteArrangement(arrangementId);
  redirect(`/songs/${songId}`);
}
