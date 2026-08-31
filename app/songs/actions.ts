"use server";

import { redirect } from "next/navigation";
import * as songs from "@/lib/db/songs";
import * as arrangements from "@/lib/db/arrangements";
import { ArrangementValidationError, RecordInUseError } from "@/lib/db/validation";
import { formStr as str } from "@/lib/form-data";

export interface FormState {
  error?: string;
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
  try {
    await songs.deleteSong(id);
  } catch (err) {
    if (err instanceof RecordInUseError) {
      redirect(`/songs/${id}/delete?error=${encodeURIComponent(err.message)}`);
    }
    throw err;
  }
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
  let bpm: number | undefined;
  if (bpmRaw !== undefined) {
    bpm = Number(bpmRaw);
    // The column is `int`; a decimal, zero, negative, or absurd value would
    // otherwise fail deep in the INSERT as an unhandled 500.
    if (!Number.isInteger(bpm) || bpm <= 0 || bpm >= 1000) {
      return { error: "BPM must be a whole number between 1 and 999." };
    }
  }

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
  try {
    await arrangements.deleteArrangement(arrangementId);
  } catch (err) {
    if (err instanceof RecordInUseError) {
      redirect(
        `/songs/${songId}/arrangements/${arrangementId}/delete?error=${encodeURIComponent(err.message)}`,
      );
    }
    throw err;
  }
  redirect(`/songs/${songId}`);
}
