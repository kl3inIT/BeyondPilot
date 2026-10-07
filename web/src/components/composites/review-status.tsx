import { Status } from "@/components/composites/status";

/**
 * What GenAI Fund's review made of a record, from a draft to a decision, `suspended` for an
 * approved record GenAI Fund took down, and `closed` for a use case whose deadline has passed.
 */
type ReviewState =
  "draft" | "in_review" | "needs_changes" | "approved" | "rejected" | "suspended" | "closed";

const tones = {
  draft: "neutral",
  in_review: "warning",
  needs_changes: "warning",
  approved: "success",
  rejected: "destructive",
  suspended: "destructive",
  closed: "neutral",
} as const;

/**
 * How the review of a record reads: its status, or `suspended` while GenAI Fund has an approved
 * record taken down. A record taken down and sent again reads as the review it waits for.
 */
function reviewState<Status extends string>(record: {
  status: Status;
  suspendedAt?: string | null;
}): Status | "suspended" {
  return record.suspendedAt && record.status === "approved" ? "suspended" : record.status;
}

type ReviewStatusProps = {
  state: ReviewState;
  /** A dot before the word, or the word on a pastel ground beside a record's name. */
  appearance?: "dot" | "pill";
  children: React.ReactNode;
};

/** The review state of a record as a dot and its word; the word is given already translated. */
function ReviewStatus({ state, appearance, children }: ReviewStatusProps) {
  return (
    <Status tone={tones[state]} appearance={appearance}>
      {children}
    </Status>
  );
}

export { ReviewStatus, reviewState, type ReviewState };
