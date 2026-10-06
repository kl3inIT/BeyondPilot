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

/** The review state of a record as a dot and its word; the word is given already translated. */
function ReviewStatus({ state, children }: { state: ReviewState; children: React.ReactNode }) {
  return <Status tone={tones[state]}>{children}</Status>;
}

export { ReviewStatus, type ReviewState };
