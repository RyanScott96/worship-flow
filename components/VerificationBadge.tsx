import type { ReviewStatus } from "@/lib/db/types";

const STYLE: Record<ReviewStatus, string> = {
  verified: "bg-success/15 text-success",
  flagged: "bg-warning/15 text-warning",
  unverified: "bg-muted text-muted-foreground",
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
