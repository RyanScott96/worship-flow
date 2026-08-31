/** A trimmed non-empty string field from a FormData, or undefined. */
export function formStr(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
