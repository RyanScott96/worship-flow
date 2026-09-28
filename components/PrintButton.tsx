"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      data-print-hide
      className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground"
    >
      Print / Save PDF
    </button>
  );
}
