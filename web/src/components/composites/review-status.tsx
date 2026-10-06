import { Status } from "@/components/composites/status";

/** What GenAI Fund's review made of a record, from a draft to a decision. */
type ReviewState = "draft" | "pending" | "submitted" | "approved" | "rejected" | "suspended";

const tones = {
  draft: "neutral",
  pending: "warning",
  submitted: "warning",
  approved: "success",
  rejected: "destructive",
  suspended: "destructive",
} as const;

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

export { ReviewStatus, type ReviewState };
