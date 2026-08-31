"use server";

import { redirect } from "next/navigation";
import * as services from "@/lib/db/services";
import { ServiceValidationError } from "@/lib/db/validation";
import type { ServiceItemType } from "@/lib/db/types";

export interface FormState {
  error?: string;
}

function str(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function serviceInput(formData: FormData) {
  const name = str(formData, "name");
  const startsAt = str(formData, "startsAt");
  if (!name) throw new ServiceValidationError("Give the service a name.");
  if (!startsAt) throw new ServiceValidationError("Pick a date and time.");
  return { name, startsAt, notes: str(formData, "notes") };
}

export async function createServiceAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  let serviceId: string;
  try {
    ({ serviceId } = await services.createService(serviceInput(formData)));
  } catch (err) {
    if (err instanceof ServiceValidationError) return { error: err.message };
    throw err;
  }
  redirect(`/services/${serviceId}`);
}

export async function updateServiceAction(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await services.updateService(id, serviceInput(formData));
  } catch (err) {
    if (err instanceof ServiceValidationError) return { error: err.message };
    throw err;
  }
  redirect(`/services/${id}`);
}

export async function deleteServiceAction(id: string): Promise<void> {
  await services.deleteService(id);
  redirect("/services");
}

export async function addSongItemAction(
  serviceId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const arrangementId = str(formData, "arrangementId");
  if (!arrangementId) return { error: "Choose an arrangement." };
  try {
    await services.addSongItem(serviceId, {
      arrangementId,
      keyOverride: str(formData, "keyOverride"),
      capo: str(formData, "capo"),
      notes: str(formData, "notes"),
    });
  } catch (err) {
    if (err instanceof ServiceValidationError) return { error: err.message };
    throw err;
  }
  redirect(`/services/${serviceId}`);
}

export async function addNonSongItemAction(
  serviceId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const itemType = str(formData, "itemType") as ServiceItemType | undefined;
  const title = str(formData, "title");
  if (!itemType || itemType === "song") return { error: "Pick an item type." };
  if (!title) return { error: "Give the item a title." };
  try {
    await services.addNonSongItem(serviceId, {
      itemType,
      title,
      notes: str(formData, "notes"),
    });
  } catch (err) {
    if (err instanceof ServiceValidationError) return { error: err.message };
    throw err;
  }
  redirect(`/services/${serviceId}`);
}

export async function updateServiceItemAction(
  serviceId: string,
  itemId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await services.updateServiceItem(itemId, {
      keyOverride: str(formData, "keyOverride"),
      capo: str(formData, "capo"),
      title: str(formData, "title"),
      notes: str(formData, "notes"),
    });
  } catch (err) {
    if (err instanceof ServiceValidationError) return { error: err.message };
    throw err;
  }
  redirect(`/services/${serviceId}`);
}

export async function removeServiceItemAction(
  serviceId: string,
  itemId: string,
): Promise<void> {
  await services.removeServiceItem(itemId);
  redirect(`/services/${serviceId}`);
}

export async function moveServiceItemAction(
  serviceId: string,
  itemId: string,
  direction: "up" | "down",
): Promise<void> {
  await services.moveServiceItem(serviceId, itemId, direction);
  redirect(`/services/${serviceId}`);
}
