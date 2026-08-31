import type { ReviewStatus } from "@/lib/db/types";

const STYLE: Record<ReviewStatus, string> = {
  verified: "bg-green-600/15 text-green-700 dark:text-green-400",
  flagged: "bg-amber-600/15 text-amber-700 dark:text-amber-400",
  unverified: "bg-black/10 text-black/60 dark:bg-white/10 dark:text-white/60",
};

const LABEL: Record<ReviewStatus, string> = {
  verified: "Verified",
  flagged: "Flagged",
  unverified: "Unverified",
};

/**
 * D-07: the verification state, shown where it can still change what you do —
 * the setlist builder, not just the chart view.
 */
export function VerificationBadge({ status }: { status: ReviewStatus }) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-xs font-medium ${STYLE[status]}`}
    >
      {LABEL[status]}
    </span>
  );
}
